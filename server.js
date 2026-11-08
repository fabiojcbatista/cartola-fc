// Backend intermediário simples: evita CORS e mantém a sessão Globo (GLBID) do Cartola.
// Requer Node.js 18 ou superior. Não exige dependências externas.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
// Por segurança (o login passa por aqui), o servidor só aceita conexões da própria máquina.
const HOST = process.env.HOST || "127.0.0.1";
const API_HOSTS = process.env.CARTOLA_API
  ? [process.env.CARTOLA_API]
  : ["https://api.cartola.globo.com", "https://api.cartolafc.globo.com"];
const SESSION_TTL = 60 * 60 * 1000; // o token do login novo da Globo vale ~1 hora
const COOKIE = "sf_session";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const ROOT = __dirname;

// sessionId -> { token, expires }. Fica só na memória: o token da Globo nunca vai para o navegador.
const sessions = new Map();

function send(res, status, body, type = "text/plain; charset=utf-8", extra = {}) {
  res.writeHead(status, { "Content-Type": type, ...extra });
  res.end(body);
}
function sendJson(res, status, obj, extra = {}) {
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8", { "Cache-Control": "no-store", ...extra });
}

function sessionIdFrom(req) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([a-f0-9]+)"));
  return m ? m[1] : null;
}
function getSession(req) {
  const sid = sessionIdFrom(req);
  const s = sid && sessions.get(sid);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(sid); return null; }
  return s;
}
function cookieHeader(value, maxAgeSec) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
}

function readJson(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", c => { raw += c; if (raw.length > limit) { reject(new Error("grande demais")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

// Bloqueia chamadas de POST vindas de outros sites (CSRF).
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// Cabeçalhos de autenticação. Login novo (OIDC): Bearer + x-glb-auth/x-glb-app.
// Login antigo (GLBID): X-GLB-Token. Misturar os dois confunde a API, então cada tipo usa só os seus.
function authHeadersFor(session) {
  if (!session) return {};
  if (session.kind === "oidc") {
    return { "Authorization": "Bearer " + session.token, "x-glb-auth": "oidc", "x-glb-app": "cartola_web", "Origin": "https://cartola.globo.com" };
  }
  return { "X-GLB-Token": session.token, "Cookie": "GLBID=" + session.token };
}

// Confere se a credencial é aceita pela API do Cartola (tenta os dois endereços).
async function credentialIsValid(session) {
  let last = 502;
  for (const host of API_HOSTS) {
    try {
      const r = await fetch(new URL("/auth/time", host), {
        headers: { "Accept": "application/json", "User-Agent": UA, "Referer": "https://cartola.globo.com/", ...authHeadersFor(session) },
        signal: AbortSignal.timeout(20000)
      });
      if (r.ok || r.status === 404) return { ok: true }; // 404 = conta válida, mas sem time escalado
      last = r.status;
    } catch { /* tenta o próximo host */ }
  }
  return { ok: false, status: last };
}

// Recebe da página do painel as credenciais entregues pela extensão e valida na API.
async function handleLogin(req, res) {
  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  const clean = v => String(v || "").trim().replace(/^Bearer\s+/i, "");
  const ok = v => v && /^[\w\-.~+\/=%:]+$/.test(v);
  const candidates = [
    { kind: "oidc", token: clean(body.bearer) },
    { kind: "legacy", token: clean(body.glbid) }
  ].filter(c => ok(c.token));
  if (!candidates.length) return sendJson(res, 400, { error: "Nenhuma credencial da Globo foi recebida." });

  const tried = [];
  for (const c of candidates) {
    const check = await credentialIsValid(c);
    if (check.ok) {
      const old = sessionIdFrom(req);
      if (old) sessions.delete(old);
      const sid = crypto.randomBytes(24).toString("hex");
      sessions.set(sid, { token: c.token, kind: c.kind, expires: Date.now() + SESSION_TTL });
      return sendJson(res, 200, { loggedIn: true, kind: c.kind }, { "Set-Cookie": cookieHeader(sid, SESSION_TTL / 1000) });
    }
    tried.push(`${c.kind === "oidc" ? "login novo" : "login antigo"}: HTTP ${check.status}`);
  }
  const hint = candidates.some(c => c.kind === "oidc")
    ? "O token pode ter vencido (vale ~1 hora). Recarregue a aba do Cartola e tente de novo."
    : "Só encontrei o cookie antigo, que a API não aceita mais. Abra cartola.globo.com logado, deixe a página carregar e tente de novo.";
  return sendJson(res, tried.some(t => /HTTP 502/.test(t)) ? 502 : 401, { error: "A API do Cartola recusou a sessão (" + tried.join("; ") + "). " + hint });
}

function proxyCartola(apiPath, res, session) {
  let hostIndex = 0;
  // A credencial só é enviada para endpoints autenticados (/auth/...).
  const authHeaders = session && apiPath.startsWith("/auth/") ? authHeadersFor(session) : {};
  function attempt() {
    const url = new URL(apiPath, API_HOSTS[hostIndex]);
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.get(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://cartola.globo.com/",
        ...authHeaders
      },
      timeout: 20000
    }, upstream => {
      let data = "";
      upstream.setEncoding("utf8");
      upstream.on("data", chunk => data += chunk);
      upstream.on("end", () => {
        if (upstream.statusCode >= 400 && hostIndex < API_HOSTS.length - 1) {
          hostIndex++;
          return attempt();
        }
        send(res, upstream.statusCode || 502, data, upstream.headers["content-type"] || "application/json; charset=utf-8", Object.keys(authHeaders).length ? { "Cache-Control": "no-store" } : {});
      });
    });
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao consultar Cartola FC")));
    req.on("error", err => {
      if (hostIndex < API_HOSTS.length - 1) { hostIndex++; return attempt(); }
      send(res, 502, JSON.stringify({ error: "Falha ao consultar API Cartola", detail: err.message }), "application/json; charset=utf-8");
    });
  }
  attempt();
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (parsed.pathname.startsWith("/auth/")) {
    if (req.method === "POST" && !sameOrigin(req)) return sendJson(res, 403, { error: "Origem não permitida." });
    if (parsed.pathname === "/auth/login" && req.method === "POST") return handleLogin(req, res);
    if (parsed.pathname === "/auth/me" && req.method === "GET") return sendJson(res, 200, { loggedIn: !!getSession(req) });
    if (parsed.pathname === "/auth/logout" && req.method === "POST") {
      const sid = sessionIdFrom(req);
      if (sid) sessions.delete(sid);
      return sendJson(res, 200, { loggedIn: false }, { "Set-Cookie": cookieHeader("", 0) });
    }
    return sendJson(res, 404, { error: "Rota não encontrada." });
  }

  if (parsed.pathname.startsWith("/api/cartola/")) {
    const apiPath = parsed.pathname.replace(/^\/api\/cartola/, "") + parsed.search;
    const session = getSession(req);
    if (apiPath.startsWith("/auth/") && !session) {
      return sendJson(res, 401, { error: "Faça login com sua conta Globo." });
    }
    return proxyCartola(apiPath, res, session);
  }

  let requested = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const file = path.join(ROOT, path.normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  fs.readFile(file, (err, content) => {
    if (err) return send(res, 404, "Arquivo não encontrado");
    const ext = path.extname(file).toLowerCase();
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
    send(res, 200, content, types[ext] || "application/octet-stream");
  });
});
server.listen(PORT, HOST, () => console.log(`Superliga do Fabião disponível em http://localhost:${PORT}`));
