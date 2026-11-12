// Backend intermediário: evita CORS, mantém a sessão Globo (token OIDC) e faz o LOGIN
// DIRETO pela conta, SEM EXTENSÃO DE NAVEGADOR.
// Requer Node.js 18 ou superior. Não exige dependências externas.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

// LOCAL
//const PORT = process.env.PORT || 3000;
// Por segurança (o login passa por aqui), o servidor só aceita conexões da própria máquina.
//const HOST = process.env.HOST || "127.0.0.1";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";   // ← importante na nuvem

const API_HOSTS = process.env.CARTOLA_API
  ? [process.env.CARTOLA_API]
  : ["https://api.cartola.globo.com", "https://api.cartolafc.globo.com"];
const SESSION_TTL = 60 * 60 * 1000; // access_token do OIDC vale ~1 hora (renovado sozinho)
const SESSION_COOKIE_TTL = 7 * 24 * 60 * 60; // o cookie local dura 7 dias; a renovação é automática
const OIDC_FLOW_TTL = 15 * 60 * 1000; // tempo para concluir o login pela janela da Globo
const COOKIE = "sf_session";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const ROOT = __dirname;

// ===== Login pela CONTA GLOBO, sem extensão =====
// Fluxo OIDC real do site do Cartola (confirmado ao vivo em 12/11/2026):
//  - Keycloak da Globo: goidc.globo.com, realm "globo.com", client "cartola-web@apps.globoid";
//  - redirect_uri registrado: https://cartola.globo.com/login-callback.html (o local NÃO é aceito:
//    "The 'redirect_uri' parameter does not match any of the OAuth 2.0 Client's pre-registered
//    redirect urls");
//  - o próprio site troca o código por token com PKCE (callback.min.js, globoid-js);
//  - a página de login da Globo exige hCaptcha, por isso o usuário entra nela de verdade
//    (e-mail/senha/Google/Facebook) e o SERVIDOR local faz a troca do código pelo token
//    com o verifier que só ele tem. Depois, renova sozinho com o refresh_token.
// Login por e-mail/senha direto na API continua disponível como atalho, mas a Globo pode
// exigir captcha a qualquer momento — quando pede, respondemos needsGloboWindow.
const AUTHX_API = process.env.AUTHX_API || "https://authx-api.globoid.globo.com/v1";
const OIDC_AUTH_URL = process.env.OIDC_AUTH_URL || "https://goidc.globo.com/auth/realms/globo.com/protocol/openid-connect/auth";
const OIDC_TOKEN_URL = process.env.OIDC_TOKEN_URL || "https://goidc.globo.com/auth/realms/globo.com/protocol/openid-connect/token";
// Base dos endpoints de SESSÃO da Globo (logout/end-session e revogação de token — RFC 7009).
const OIDC_BASE = OIDC_TOKEN_URL.replace(/\/token$/, "");
const OIDC_CLIENT = process.env.OIDC_CLIENT || "cartola-web@apps.globoid";
// redirect_uri TEM de ser o registrado no client da Globo (validado ao vivo; localhost é rejeitado).
const OIDC_REDIRECT_URI = "https://cartola.globo.com/login-callback.html";
const OIDC_SCOPE = process.env.OIDC_SCOPE || "openid profile glbid";

// sessionId -> sessão; state OIDC -> { verifier, ts }. Tudo só na memória: token e verifier
// do PKCE nunca vão para o navegador.
const sessions = new Map();
const oidcFlows = new Map();

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

// Cabeçalhos de autenticação: a API do Cartola aceita somente o token OIDC
// (Authorization: Bearer + x-glb-auth/x-glb-app). O cookie antigo GLBID dá 401.
function authHeadersFor(session) {
  if (!session) return {};
  return { "Authorization": "Bearer " + session.token, "x-glb-auth": "oidc", "x-glb-app": "cartola_web", "Origin": "https://cartola.globo.com" };
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

const cleanToken = v => String(v || "").trim().replace(/^Bearer\s+/i, "");
const tokenOk = v => v && /^[\w\-.~+\/=%:]+$/.test(v);
const num = v => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
// Valida a credencial e, se aceita, cria a sessão local (mesma de sempre: só na memória).
async function startSession(req, res, candidate) {
  const check = await credentialIsValid(candidate);
  if (!check.ok) return check;
  const old = sessionIdFrom(req);
  if (old) sessions.delete(old);
  const sid = crypto.randomBytes(24).toString("hex");
  const ttl = candidate.expiresIn ? Math.max(60, (candidate.expiresIn - 30) * 1000) : SESSION_TTL;
  // id_token fica guardado para o LOGOUT: é o "id_token_hint" que faz a Globo encerrar a
  // sessão de SSO do navegador sem página de confirmação. Só memória do servidor, como os outros.
  sessions.set(sid, { token: candidate.token, kind: "oidc", refreshToken: candidate.refreshToken || null, idToken: candidate.idToken || null, expires: Date.now() + ttl });
  sendJson(res, 200, { loggedIn: true, kind: "oidc", comRenovacao: !!candidate.refreshToken }, { "Set-Cookie": cookieHeader(sid, SESSION_COOKIE_TTL) });
  return { ok: true, created: true };
}

/* ===== Login direto por e-mail/senha (atalho; a Globo pode pedir captcha) ===== */
async function safeText(r) { try { return await r.text(); } catch { return ""; } }

// Procura na resposta JWTs OIDC utilizáveis (3 segmentos). GLBID/legado não é mais aceito pela API.
function extrairCredenciais(corpo) {
  const out = [];
  const push = v => { const t = cleanToken(v); if (tokenOk(t) && /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t) && !out.includes(t)) out.push(t); };
  const walk = (obj) => {
    if (typeof obj === "string") { push(obj); return; }
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    for (const v of Object.values(obj)) walk(v);
  };
  try { walk(JSON.parse(corpo)); } catch { /* resposta não-JSON: sem credenciais */ }
  return out;
}

// Classifica a falha de uma tentativa de login (sem expor detalhes sensíveis).
function classifyLoginFailure(status, corpo) {
  const low = String(corpo || "").toLowerCase();
  if (low.includes("captcha")) return "captcha";
  if (status === 401 || status === 403 || status === 406) return "credenciais";
  return "erro";
}

async function postJson(url, obj, extraHeaders = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA, ...extraHeaders },
    body: JSON.stringify(obj),
    signal: AbortSignal.timeout(25000)
  });
}

// Conta Globo (authx) — o mesmo fluxo que o site do Cartola usa (client/serviceId conferidos).
async function tentativaAuthx(email, senha) {
  const headers = {
    "Origin": "https://authx.globoid.globo.com",
    "Referer": "https://authx.globoid.globo.com/6860/login",
    "x-finish-url": "https://cartola.globo.com/"
  };
  const r1 = await postJson(`${AUTHX_API}/auth/start`, { email, serviceId: 6860, captcha: "" }, headers);
  if (!r1.ok) return { falhou: true, origem: "authx/start", status: r1.status, corpo: await safeText(r1) };
  const r2 = await postJson(`${AUTHX_API}/auth/authenticate`, { captcha: "", email, password: senha, serviceId: 6860 }, headers);
  const corpo = await safeText(r2);
  if (!r2.ok) return { falhou: true, origem: "authx/authenticate", status: r2.status, corpo };
  return { tokens: extrairCredenciais(corpo) };
}

// Recebe e-mail e senha do painel e tenta o login direto na Conta Globo (authx).
// A senha é usada aqui e descartada — nunca é gravada nem registrada em log.
async function handleLoginDireto(req, res) {
  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  const email = String(body.email || "").trim();
  const senha = String(body.senha || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Informe um e-mail válido." });
  if (!senha) return sendJson(res, 400, { error: "Informe a senha." });

  let captcha = false, credenciais = false, recebeuToken = false;
  let r;
  try { r = await tentativaAuthx(email, senha); } catch (e) { r = { falhou: true, origem: "rede", status: 0, corpo: e.message }; }
  if (r.falhou) {
    const k = classifyLoginFailure(r.status, r.corpo);
    if (k === "captcha") captcha = true;
    else if (k === "credenciais") credenciais = true;
  } else {
    recebeuToken = true;
    for (const jwt of r.tokens) {
      const created = await startSession(req, res, { token: jwt });
      if (created.created) return; // sessão criada e resposta enviada
    }
  }
  if (recebeuToken) return sendJson(res, 502, { error: "O login na Globo foi aceito, mas a API do Cartola recusou a sessão. Tente de novo em instantes ou entre pela janela oficial da Globo." });
  if (credenciais) return sendJson(res, 401, { error: "E-mail ou senha incorretos. Confira e tente de novo, ou entre pela janela oficial da Globo (sem digitar a senha aqui)." });
  if (captcha) return sendJson(res, 200, { needsGloboWindow: true, error: "A Globo pediu verificação de segurança (captcha) para o login por aqui. Sem problema: a janela oficial da Globo foi aberta — entre nela (a senha fica só com a Globo) e cole o endereço final no painel." });
  return sendJson(res, 502, { error: "Não consegui falar com os servidores de login da Globo agora. Tente de novo em instantes ou entre pela janela oficial da Globo. (authx HTTP " + r.status + ")" });
}

/* ===== Login pela JANELA OFICIAL da Globo (OIDC do próprio Cartola, sem extensão) ===== */
// Como funciona: o servidor gera o desafio PKCE, manda a janela para a página de login real
// da Globo (a mesma do site do Cartola) e, quando o usuário entra, a Globo volta com um CÓDIGO
// no endereço final. O usuário cola esse endereço no painel; o servidor troca o código pelo
// token OIDC (Authorization: Bearer) usando o verifier que só ele tem, e a sessão é criada.
// O refresh_token (quando a Globo entrega) renova a sessão sozinho por até 7 dias.
function oidcFlowCleanup() {
  const agora = Date.now();
  for (const [k, f] of oidcFlows) if (agora - f.ts > OIDC_FLOW_TTL) { if (f.auto && f.auto.close) f.auto.close(); oidcFlows.delete(k); }
}
const b64url = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Cria o fluxo PKCE (verifier só na memória do servidor) e devolve { flowId, authUrl }.
function criarFluxoOidc() {
  oidcFlowCleanup();
  const flowId = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  oidcFlows.set(flowId, { verifier, ts: Date.now() });
  const authUrl = OIDC_AUTH_URL + "?" + new URLSearchParams({
    client_id: OIDC_CLIENT,
    response_type: "code",
    redirect_uri: OIDC_REDIRECT_URI,
    scope: OIDC_SCOPE,
    state: flowId,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  return { flowId, authUrl };
}

// POST /auth/oidc/start -> cria o fluxo (modo manual) e devolve { flowId, authUrl }.
async function handleOidcStart(req, res) {
  return sendJson(res, 200, criarFluxoOidc());
}

// GET /auth/oidc/go?id=... -> manda a janela para a página real de login da Globo.
function handleOidcGo(req, res) {
  const parsed = new URL(req.url, "http://x");
  const flow = oidcFlows.get(parsed.searchParams.get("id") || "");
  if (!flow) return send(res, 400, "Pedido de login inexistente ou vencido. Feche esta janela e clique de novo em Entrar.");
  res.writeHead(302, { Location: OIDC_AUTH_URL + "?" + new URLSearchParams({
    client_id: OIDC_CLIENT, response_type: "code", redirect_uri: OIDC_REDIRECT_URI,
    scope: OIDC_SCOPE, state: parsed.searchParams.get("id"), code_challenge: b64url(crypto.createHash("sha256").update(flow.verifier).digest()), code_challenge_method: "S256"
  }) });
  res.end();
}

// Extrai o código do endereço colado (aceita query ou fragmento, com ou sem state).
function codigoDoEndereco(texto) {
  const m = String(texto || "").match(/[?&#]code=([\w\-.~+%]+)/);
  const st = String(texto || "").match(/[?&#]state=([\w\-.~+%]+)/);
  return { code: m ? decodeURIComponent(m[1]) : null, state: st ? decodeURIComponent(st[1]) : null };
}

// Troca o código (uso único) pelo token OIDC com o verifier do PKCE. Devolve { dados } ou { status, error }.
async function trocarCodigoPorToken(code, verifier) {
  const troca = async (scope) => {
    try {
      const r = await fetch(OIDC_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: OIDC_CLIENT, redirect_uri: OIDC_REDIRECT_URI, code_verifier: verifier, scope }),
        signal: AbortSignal.timeout(25000)
      });
      return { status: r.status, corpo: await safeText(r) };
    } catch (e) { return { status: 0, corpo: e.message }; }
  };
  let t = await troca(OIDC_SCOPE + " offline"); // offline pede refresh_token
  if (t.status === 0 || t.status >= 400) t = await troca(OIDC_SCOPE); // sem offline, do mesmo jeito
  if (t.status === 0 || t.status >= 400) {
    let desc = "";
    try { desc = JSON.parse(t.corpo).error_description || JSON.parse(t.corpo).error || ""; } catch { desc = String(t.corpo).slice(0, 120); }
    const vencido = /invalid_grant|already been used|expired|not valid/i.test(desc) || /invalid_grant/.test(desc);
    return { status: vencido ? 401 : 502, error: vencido
      ? "O código não foi aceito (ele vale poucos minutos e é de uso único). Clique de novo em Entrar pela janela da Globo."
      : "Não consegui trocar o código pelo token agora. Tente de novo em instantes. (" + desc.slice(0, 90) + ")" };
  }
  let dados = {};
  try { dados = JSON.parse(t.corpo); } catch {}
  if (!dados.access_token || !tokenOk(cleanToken(dados.access_token))) return { status: 502, error: "A Globo respondeu sem token utilizável. Tente de novo." };
  return { dados };
}

// POST /auth/oidc/exchange { endereco | code, state } -> troca o código pelo token e cria a sessão.
async function handleOidcExchange(req, res) {
  let body;
  try { body = await readJson(req, 20000); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  oidcFlowCleanup();
  const parsed = body.endereco ? codigoDoEndereco(body.endereco) : { code: cleanToken(body.code), state: body.state };
  const code = parsed.code;
  const state = parsed.state || body.state; // se o endereço vier sem state, usa o fluxo aberto pelo painel
  if (!code) return sendJson(res, 400, { error: "Não encontrei o código nesse endereço. Copie a linha COMPLETA do navegador (ela contém ?code=…&state=…)." });
  const flow = oidcFlows.get(state || "");
  if (!flow) return sendJson(res, 400, { error: "Esse login não começou aqui ou já venceu (15 min). Clique de novo em Entrar pela janela da Globo — agora será rápido, sua sessão Globo já está ativa." });
  oidcFlows.delete(state); // o código é de uso único: não deixa tentar duas vezes

  const r = await trocarCodigoPorToken(code, flow.verifier);
  if (r.error) return sendJson(res, r.status, { error: r.error });
  const dados = r.dados;
  const created = await startSession(req, res, { token: cleanToken(dados.access_token), refreshToken: dados.refresh_token || null, idToken: tokenOk(cleanToken(dados.id_token)) ? cleanToken(dados.id_token) : null, expiresIn: num(dados.expires_in) ?? null });
  if (created.created) return; // resposta enviada por startSession
  return sendJson(res, 401, { error: "A Globo aceitou o login, mas a API do Cartola recusou a sessão (HTTP " + created.status + "). Tente entrar de novo." });
}

// GET /auth/oidc/done -> páginazinha de encerramento da janela.
function handleOidcDone(req, res) {
  send(res, 200, "<!doctype html><html lang=pt-BR><meta charset=utf-8><title>Login concluído</title>" +
    "<body style=\"font-family:sans-serif;text-align:center;padding-top:70px;background:#eef2f8\">" +
    "<div style=\"font-size:52px\">\u2705</div><h2 style=\"color:#102044\">Login concluído!</h2>" +
    "<p style=\"color:#6d7890\">Esta janela pode ser fechada. Volte ao painel.</p>" +
    "<script>setTimeout(()=>{try{window.close()}catch(e){}},1800)<\/script>", "text/html; charset=utf-8");
}

/* ===== Login AUTOMÁTICO: o servidor abre um Chrome/Edge controlado e captura o retorno sozinho =====
   Por que funciona: o navegador do painel não pode ler o endereço final (a Globo só redireciona para
   cartola.globo.com e o domínio é outro). Mas o SERVIDOR pode abrir o Chrome com a porta de depuração
   (CDP) ligada, vigiar a navegação e capturar o retorno (login-callback.html?code=…&state=…) com
   TRÊS redes independentes:
     1. INTERCEPTAÇÃO DA REQUISIÇÃO (Fetch) — pega o endereço ANTES de a página da Globo carregar;
     2. VIGIA DO ENDEREÇO DA JANELA (targetInfoChanged) — pega trocas de URL da aba, inclusive #fragmento;
     3. COPIA POR JS — repórter injetado em toda página: a própria página entrega o seu endereço ao
        servidor por um binding interno do DevTools. Pega até troca de endereço que não gera
        requisição (history.replaceState) e mudanças tardias de URL.
   Qualquer uma conclui o login; as outras ficam de segurança. Assim:
     · nada é copiado/colado e não há extensão;
     · o código chega inteiro ao servidor, que troca pelo token com o verifier do PKCE;
     · com a captura 1, a página de retorno da Globo nem roda (não "gasta" o código de uso único);
     · a senha continua só na página da Globo (hCaptcha, Google, Facebook funcionam normalmente);
     · no fim o servidor FECHA O NAVEGADOR sozinho (Browser.close) e o painel carrega as ligas.
   O Chrome usa um perfil PRÓPRIO (CHROME_PROFILE), separado do seu dia a dia. Sem Chrome/Edge ou
   sem conseguir controlá-lo, o painel cai sozinho no modo manual (copiar e colar o endereço). */
const CHROME_PROFILE = process.env.CHROME_PROFILE || path.join(os.homedir(), ".superliga-fabiao", "chrome-globo");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const procsNavegador = new Set();
process.on("exit", () => { for (const p of procsNavegador) { try { p.kill(); } catch {} } });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
let autoAtual = null; // flowId do login automático em andamento (só um por vez)

function acharNavegador() {
  const cand = [];
  if (process.env.CHROME_PATH) cand.push(process.env.CHROME_PATH);
  if (process.platform === "win32") {
    const bases = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    for (const b of bases) {
      cand.push(path.join(b, "Google", "Chrome", "Application", "chrome.exe"));
      cand.push(path.join(b, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
  } else if (process.platform === "darwin") {
    cand.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium");
  } else {
    const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable"])
      for (const d of dirs) cand.push(path.join(d, n));
  }
  return cand.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

// Cliente WebSocket mínimo (RFC 6455), só o necessário para falar com o Chrome (sem dependências).
function wsConnect(urlStr, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const key = crypto.randomBytes(16).toString("base64");
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search, timeout: timeoutMs,
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": key, "Sec-WebSocket-Version": "13" }
    });
    req.on("timeout", () => req.destroy(new Error("tempo esgotado no handshake")));
    req.on("error", reject);
    req.on("response", r => { r.resume(); reject(new Error("handshake HTTP " + r.statusCode)); });
    req.on("upgrade", (res, socket, head) => {
      const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      if (res.headers["sec-websocket-accept"] !== accept) { socket.destroy(); return reject(new Error("handshake inválido")); }
      socket.setTimeout(0);
      let buf = Buffer.alloc(0), frags = [], fragOp = 0, fechado = false;
      const api = { onmessage: null, onclose: null };
      const frame = (op, payload) => {
        const mask = crypto.randomBytes(4);
        let h;
        if (payload.length < 126) h = Buffer.from([0x80 | op, 0x80 | payload.length]);
        else if (payload.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 0x80 | 126; h.writeUInt16BE(payload.length, 2); }
        else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 0x80 | 127; h.writeUInt32BE(Math.floor(payload.length / 4294967296), 2); h.writeUInt32BE(payload.length >>> 0, 6); }
        const m = Buffer.from(payload);
        for (let i = 0; i < m.length; i++) m[i] ^= mask[i & 3];
        socket.write(Buffer.concat([h, mask, m]));
      };
      const parse = () => {
        for (;;) {
          if (buf.length < 2) return;
          const fin = !!(buf[0] & 0x80), op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80);
          let len = buf[1] & 0x7f, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(2) * 4294967296 + buf.readUInt32BE(6); off = 10; }
          let mk = null;
          if (masked) { if (buf.length < off + 4) return; mk = buf.subarray(off, off + 4); off += 4; }
          if (buf.length < off + len) return;
          const payload = Buffer.from(buf.subarray(off, off + len));
          buf = buf.subarray(off + len);
          if (mk) for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3];
          if (op === 8) { try { socket.end(); } catch {} return; }
          if (op === 9) { frame(10, payload); continue; }
          if (op === 10) continue;
          if (op === 0 || op === 1 || op === 2) {
            if (op !== 0) { fragOp = op; frags = [payload]; } else frags.push(payload);
            if (fin) {
              const full = Buffer.concat(frags); frags = [];
              if (fragOp === 1 && api.onmessage) { try { api.onmessage(full.toString("utf8")); } catch {} }
            }
          }
        }
      };
      socket.on("data", d => { buf = Buffer.concat([buf, d]); parse(); });
      const fim = () => { if (fechado) return; fechado = true; if (api.onclose) api.onclose(); };
      socket.on("close", fim); socket.on("error", fim);
      api.send = text => { if (!fechado) frame(1, Buffer.from(text, "utf8")); };
      api.close = () => { try { socket.destroy(); } catch {} };
      if (head && head.length) { buf = Buffer.from(head); setImmediate(parse); }
      resolve(api);
    });
    req.end();
  });
}

const HTML_RETORNO = "<!doctype html><html lang=pt-BR><meta charset=utf-8><title>Login recebido</title>" +
  "<body style=\"font-family:sans-serif;text-align:center;padding-top:70px;background:#eef2f8\">" +
  "<div style=\"font-size:52px\">\u2705</div><h2 style=\"color:#102044\">Login recebido!</h2>" +
  "<p style=\"color:#6d7890\">Voltando ao painel — esta janela fecha sozinha.</p></body></html>";

// COPIA POR JS (rede de segurança nº 2): script injetado em TODA página que este navegador abrir
// (inclusive pop-ups de login social e a página de retorno). A própria página entrega o endereço
// dela ao servidor pelo binding "__sfReport" — canal interno do Chrome/DevTools, sem rede e sem
// copiar nada para a área de transferência. Cobre casos que a interceptação de requisição não vê:
// retorno só por #fragmento (não gera requisição), troca de endereço por history.replaceState e
// qualquer alteração tardia (o repórter compara o endereço a cada 0,7 s, por até 5 minutos).
const JS_REPORTER = "(function(){" +
  "if(window.__sfRepLigado)return;window.__sfRepLigado=1;" +
  // Auto-proteção: nas páginas do Google/Facebook o repórter não liga nada — não cria
  // temporizador, nem flag, nem chamada nenhuma (nada para eles "sentirem"). O retorno
  // dessas páginas não existe (o código volta na Globo), então não perdemos nada.
  "if(/google|facebook/i.test(location.hostname))return;" +
  "var u=null;var f=function(){var h=String(location.href);if(h===u)return;u=h;" +
  "try{__sfReport(h)}catch(e){}};" +
  "f();document.addEventListener('DOMContentLoaded',f);window.addEventListener('load',f);" +
  "var t=setInterval(f,700);setTimeout(function(){clearInterval(t)},300000)})()";

// Abre o Chrome/Edge com o perfil próprio, leva-o à página de login da Globo e espera o retorno.
// Devolve { done: Promise<endereço de retorno com ?code=…>, close() }. Lança erro se não conseguir
// abrir/controlar o navegador (o chamador então cai no modo manual).
async function capturarRetornoViaNavegador(authUrl, ttlMs, onAviso) {
  const exe = acharNavegador();
  if (!exe) throw new Error("Não encontrei o Google Chrome nem o Microsoft Edge neste computador (dá para indicar o caminho na variável CHROME_PATH).");
  fs.mkdirSync(CHROME_PROFILE, { recursive: true });
  const portFile = path.join(CHROME_PROFILE, "DevToolsActivePort");
  try { fs.unlinkSync(portFile); } catch {}

  const proc = spawn(exe, [
    "--user-data-dir=" + CHROME_PROFILE, "--remote-debugging-port=0",
    // Menos pistas de automação (não expõe navigator.webdriver) — ajuda o hCaptcha e a
    // própria Globo. O GOOGLE, porém, bloqueia o login por causa da PORTA DE DEPURAÇÃO
    // (aviso "Este navegador ou app pode não ser seguro" — regra do próprio Google, veja
    // suporte accounts/thread/25209002); por isso o servidor detecta a página do Google
    // e orienta: entre com e-mail e senha nesta janela, ou use o modo manual.
    "--disable-blink-features=AutomationControlled",
    "--no-first-run", "--no-default-browser-check", "--window-size=520,780", "about:blank"
  ], { stdio: "ignore" });
  procsNavegador.add(proc);
  let spawnErr = null, saiu = false, ligado = false, finished = false, ws = null, timer = null;
  proc.on("error", e => { spawnErr = e; });
  proc.on("exit", () => { saiu = true; procsNavegador.delete(proc); if (ligado) encerrar(new Error("A janela do Chrome foi fechada antes de concluir o login.")); });

  let resolveDone, rejectDone;
  const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
  done.catch(() => {});
  function encerrar(erro, url) {
    if (finished) return; finished = true; clearTimeout(timer);
    const fechar = () => {
      try { if (ws) ws.send(JSON.stringify({ id: 9999999, method: "Browser.close" })); } catch {}
      setTimeout(() => { try { if (ws) ws.close(); } catch {} try { proc.kill(); } catch {} }, 2500);
      // garantia: se nem o fechamento educado nem o SIGTERM resolverem, encerra à força
      setTimeout(() => { try { if (!saiu) proc.kill("SIGKILL"); } catch {} }, 7000);
    };
    if (erro) { rejectDone(erro); fechar(); } else { resolveDone(url); setTimeout(fechar, 900); }
  }

  // 1) espera o Chrome publicar a porta de controle (arquivo DevToolsActivePort)
  let info = null;
  for (let i = 0; i < 150 && !info && !spawnErr && !saiu; i++) {
    try { const t = fs.readFileSync(portFile, "utf8").split("\n"); if (t[0] && t[1]) info = { port: t[0].trim(), path: t[1].trim() }; } catch {}
    if (!info) await sleep(100);
  }
  const falhou = msg => { finished = true; try { proc.kill(); } catch {} throw new Error(msg); };
  if (!info) return falhou(spawnErr ? "Não consegui abrir o navegador: " + spawnErr.message : "O navegador não liberou o controle remoto (talvez já exista um Chrome aberto com o perfil do painel — feche-o e tente de novo).");
  try { ws = await wsConnect("ws://127.0.0.1:" + info.port + info.path); }
  catch (e) { return falhou("Não consegui controlar o navegador: " + e.message); }

  // 2) protocolo de controle (CDP)
  let seq = 0; const pend = new Map();
  const call = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    const t = setTimeout(() => { pend.delete(id); rej(new Error("sem resposta do navegador em " + method)); }, 15000);
    pend.set(id, { res: v => { clearTimeout(t); res(v); }, rej: e => { clearTimeout(t); rej(e); } });
    try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); } catch (e) { clearTimeout(t); pend.delete(id); rej(e); }
  });
  const paginas = new Set(), anexadas = new Set();
  // O dedo-duro do GOOGLE: ele detecta a ligação do Runtime.enable (canal de depuração) e
  // recusa o login — “Este navegador ou app pode não ser seguro”. A partir da v26, o Runtime
  // (com o repórter JS) só fica ligado em páginas da GLOBO; em páginas do Google/Facebook a
  // sessão é reanexada SEM ele. O retorno continua capturado pelas outras duas redes —
  // Fetch (intercepta a requisição do retorno) e a vigia de URL (targetInfoChanged) — que
  // não tocam no Runtime e não são visíveis para a página.
  const ehPaginaSocial = url => /accounts\.google\.com|accounts\.youtube\.com|myaccount\.google\.com|googleusercontent\.com|facebook\.com\/login/.test(String(url || ""));
  const comRuntime = new Map();   // targetId -> Runtime ligado nesta sessão
  const emTroca = new Set();      // reanexação em andamento (evita trocar duas vezes)
  // Avisos ao vivo para o painel: o GOOGLE e o FACEBOOK recusam o PRÓPRIO login dentro de
  // navegadores com a porta de depuração ligada (aviso "Este navegador ou app pode não ser
  // seguro" — regra DELES, documentada no suporte do Google; não é erro do painel nem da
  // Globo). Quando a janela cai em uma dessas páginas, o servidor avisa o painel NA HORA
  // para orientar: entre com e-mail e senha da Conta Globo nesta mesma janela (funciona
  // normalmente; a sessão Globo fica gravada no perfil próprio e as próximas nem pedem
  // login, desde que você não clique em "Sair", que apaga esses cookies) — ou use o modo
  // manual, cuja janela é a comum do navegador do usuário (ali o Google/Facebook aceitam).
  const AVISOS_SOCIAIS = [
    { nome: "Google", padrao: "accounts.google.com", msg: "O GOOGLE bloqueou o login nesta janela — o aviso “Este navegador ou app pode não ser seguro” é do próprio Google, não do painel nem da Globo. Entre com E-MAIL e SENHA da Conta Globo nesta mesma janela (funciona normalmente; as próximas entradas podem já abrir logadas — desde que você não clique em “Sair”, que apaga os cookies). Sua conta só entra com Google? No painel, o link “modo manual” ficou PISCANDO em amarelo, ao lado do botão Entrar com Globo: lá a janela é a comum do seu navegador e o Google aceita." },
    { nome: "Facebook", padrao: "facebook.com/login", msg: "O FACEBOOK costuma bloquear o login dentro desta janela controlada (não é erro do painel nem da Globo). Entre com E-MAIL e SENHA da Conta Globo nesta mesma janela — funciona normalmente. Sua conta só entra com Facebook? No painel, o link “modo manual” ficou PISCANDO em amarelo, ao lado do botão Entrar com Globo: lá a janela é a comum do seu navegador e o Facebook aceita." }
  ];
  const avisosFeitos = new Set();
  const verificar = url => {
    const alvo = String(url || "");
    for (const av of AVISOS_SOCIAIS) {
      if (!avisosFeitos.has(av.nome) && alvo.includes(av.padrao)) {
        avisosFeitos.add(av.nome);
        try { if (onAviso) onAviso(av.msg); } catch {}
      }
    }
    if (!alvo.startsWith(OIDC_REDIRECT_URI)) return;
    if (codigoDoEndereco(url).code) return encerrar(null, url);
    const m = url.match(/[?&#]error_description=([^&#]+)/) || url.match(/[?&#]error=([^&#]+)/);
    if (m) { let d = m[1]; try { d = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch {} encerrar(new Error("A Globo recusou o login: " + d.slice(0, 120))); }
  };
  const anexar = async (targetId, navegar, urlAtual) => {
    if (anexadas.has(targetId)) return;
    anexadas.add(targetId);
    let sessionId;
    try { ({ sessionId } = await call("Target.attachToTarget", { targetId, flatten: true })); }
    catch (e) { anexadas.delete(targetId); throw e; }
    // intercepta o retorno ANTES de carregar: o código é nosso, a página da Globo nem roda
    await call("Fetch.enable", { patterns: [{ urlPattern: OIDC_REDIRECT_URI + "*", requestStage: "Request" }] }, sessionId);
    // copia por JS: injeta o repórter — se a página da Globo carregar de qualquer jeito,
    // ela mesma entrega o endereço (com código) ao servidor e o navegador fecha sozinho.
    // MAS SÓ em páginas da Globo: em página do Google/Facebook o Runtime fica DESLIGADO
    // (é o que eles detectam para bloquear o login) — veja ehPaginaSocial acima.
    if (!ehPaginaSocial(urlAtual)) {
      try {
        await call("Runtime.enable", {}, sessionId);
        await call("Runtime.addBinding", { name: "__sfReport" }, sessionId);
        await call("Page.addScriptToEvaluateOnNewDocument", { source: JS_REPORTER }, sessionId);
        comRuntime.set(targetId, true);
      } catch {}
    }
    if (navegar) await call("Page.navigate", { url: authUrl }, sessionId);
  };
  // Página entrou (ou saiu) do Google/Facebook? Reanexa a sessão SEM (ou COM) o Runtime.
  // Invisível para a página: nada é recarregado, nada é visível para o JS dela.
  const reatacar = async (targetId, url) => {
    if (emTroca.has(targetId)) return;
    emTroca.add(targetId);
    try {
      try { await call("Target.detachFromTarget", { targetId }); } catch {}
      anexadas.delete(targetId); comRuntime.delete(targetId);
      await anexar(targetId, false, url);
    } catch {} finally { emTroca.delete(targetId); }
  };
  let verPaginasVazias = null;
  ws.onmessage = raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.id) { const p = pend.get(m.id); if (!p) return; pend.delete(m.id); return m.error ? p.rej(new Error(m.error.message || "erro CDP")) : p.res(m.result || {}); }
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      call("Fetch.fulfillRequest", { requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }, { name: "Cache-Control", value: "no-store" }],
        body: Buffer.from(HTML_RETORNO).toString("base64") }, m.sessionId).catch(() => {});
      verificar(request && request.url);
    } else if (m.method === "Target.targetInfoChanged") {
      const ti = m.params.targetInfo || {};
      verificar(ti.url); // rede de segurança (inclui #fragmento)
      // Troca de guarda contra o Google: entrou em página deles? Runtime OFF. Voltou para
      // a Globo? Runtime ON de novo (o repórter volta a valer nos documentos novos).
      if (ti.targetId && !emTroca.has(ti.targetId) && anexadas.has(ti.targetId)) {
        const social = ehPaginaSocial(ti.url);
        if (social && comRuntime.get(ti.targetId)) reatacar(ti.targetId, ti.url);
        else if (!social && !comRuntime.has(ti.targetId)) reatacar(ti.targetId, ti.url);
      }
    } else if (m.method === "Runtime.bindingCalled" && m.params && m.params.name === "__sfReport") {
      verificar(m.params.payload); // copia por JS: a própria página entregou o endereço dela
    } else if (m.method === "Target.targetCreated") {
      const ti = m.params.targetInfo;
      if (ti.type === "page") { paginas.add(ti.targetId); anexar(ti.targetId, false, ti.url).catch(() => {}); }
    } else if (m.method === "Target.targetDestroyed") {
      paginas.delete(m.params.targetId);
      if (!paginas.size && !finished) {
        clearTimeout(verPaginasVazias);
        verPaginasVazias = setTimeout(() => { if (!paginas.size) encerrar(new Error("A janela do Chrome foi fechada antes de concluir o login.")); }, 1200);
      }
    }
  };
  ws.onclose = () => { for (const p of pend.values()) p.rej(new Error("conexão com o navegador encerrada")); pend.clear(); encerrar(new Error("A conexão com o Chrome foi encerrada antes de concluir o login.")); };

  try {
    const { targetInfos } = await call("Target.getTargets");
    const pgs = (targetInfos || []).filter(t => t.type === "page");
    pgs.forEach(t => paginas.add(t.targetId));
    const alvo = pgs.find(t => t.url === "about:blank") || pgs[0];
    if (alvo) await anexar(alvo.targetId, true, alvo.url);
    else { const { targetId } = await call("Target.createTarget", { url: "about:blank" }); paginas.add(targetId); await anexar(targetId, true, "about:blank"); }
    await call("Target.setDiscoverTargets", { discover: true }); // janelas novas (pop-ups) também são vigiadas
  } catch (e) { encerrar(e); return falhou("Não consegui preparar a janela do Chrome: " + e.message); }

  ligado = true;
  timer = setTimeout(() => encerrar(new Error("Tempo esgotado (15 min) sem concluir o login na janela da Globo.")), ttlMs);
  if (saiu) encerrar(new Error("A janela do Chrome foi fechada antes de concluir o login."));
  return { done, close: () => encerrar(new Error("Login cancelado.")) };
}

// POST /auth/oidc/auto -> abre o Chrome controlado e devolve { flowId, auto:true }
// ou { unavailable:true, reason } (o painel então usa o modo manual).
async function handleOidcAuto(req, res) {
  if (autoAtual) { const antigo = oidcFlows.get(autoAtual); if (antigo && antigo.auto && antigo.auto.close) antigo.auto.close(); oidcFlows.delete(autoAtual); autoAtual = null; }
  const { flowId, authUrl } = criarFluxoOidc();
  const flow = oidcFlows.get(flowId);
  // O estado é criado ANTES de abrir o navegador para que os avisos ao vivo (Google/Facebook)
  // cheguem ao painel enquanto o login está em andamento.
  const auto = flow.auto = { state: "waiting", error: null, creds: null, nota: null, notaEntregue: false, close: null };
  autoAtual = flowId;
  let cap;
  try { cap = await capturarRetornoViaNavegador(authUrl, OIDC_FLOW_TTL, msg => { auto.nota = msg; }); }
  catch (e) { oidcFlows.delete(flowId); if (autoAtual === flowId) autoAtual = null; return sendJson(res, 200, { unavailable: true, reason: e.message }); }
  auto.close = cap.close;
  cap.done.then(async urlRetorno => {
    auto.state = "exchanging";
    const { code, state } = codigoDoEndereco(urlRetorno);
    if (state && state !== flowId) throw new Error("O retorno da Globo é de outra tentativa de login. Tente de novo.");
    const r = await trocarCodigoPorToken(code, flow.verifier);
    if (r.error) throw new Error(r.error);
    auto.creds = { token: cleanToken(r.dados.access_token), refreshToken: r.dados.refresh_token || null, idToken: tokenOk(cleanToken(r.dados.id_token)) ? cleanToken(r.dados.id_token) : null, expiresIn: num(r.dados.expires_in) ?? null };
    auto.state = "ready";
  }).catch(e => { auto.state = "error"; auto.error = e.message || "Falha no login automático."; });
  return sendJson(res, 200, { flowId, auto: true });
}

// GET /auth/oidc/auto/status?id=… -> espera até ~20s por novidade. Quando o token está pronto, ESTA
// resposta cria a sessão (é ela que entrega o cookie ao navegador do painel).
async function handleOidcAutoStatus(req, res) {
  const id = new URL(req.url, "http://x").searchParams.get("id") || "";
  const flow = oidcFlows.get(id);
  if (!flow || !flow.auto) return sendJson(res, 200, { state: "error", error: "Pedido de login inexistente ou vencido. Clique de novo em Entrar." });
  let fechou = false; res.on("close", () => { fechou = true; });
  const limite = Date.now() + 20000;
  while ((flow.auto.state === "waiting" || flow.auto.state === "exchanging") && !fechou && Date.now() < limite) {
    if (flow.auto.nota && !flow.auto.notaEntregue) break; // aviso urgente (Google/Facebook): entrega já, sem esperar
    await sleep(250);
  }
  if (fechou) return;
  const a = flow.auto;
  if (a.state === "ready") {
    oidcFlows.delete(id); if (autoAtual === id) autoAtual = null;
    const created = await startSession(req, res, a.creds);
    if (created.created) return; // resposta (com o cookie) enviada por startSession
    return sendJson(res, 200, { state: "error", error: "A Globo aceitou o login, mas a API do Cartola recusou a sessão (HTTP " + created.status + "). Tente entrar de novo." });
  }
  if (a.state === "error") { oidcFlows.delete(id); if (autoAtual === id) autoAtual = null; return sendJson(res, 200, { state: "error", error: a.error }); }
  if (a.state === "waiting" && a.nota && !a.notaEntregue) { a.notaEntregue = true; return sendJson(res, 200, { state: "waiting", nota: a.nota }); }
  return sendJson(res, 200, { state: "waiting" }); // nota já entregue: não repete (o painel guarda o aviso)
}

// POST /auth/oidc/auto/cancel { id } -> fecha o Chrome controlado e descarta o fluxo.
async function handleOidcAutoCancel(req, res) {
  let body = {}; try { body = await readJson(req); } catch {}
  const f = oidcFlows.get(String(body.id || ""));
  if (f && f.auto && f.auto.close) f.auto.close();
  if (f) oidcFlows.delete(String(body.id));
  if (autoAtual === body.id) autoAtual = null;
  return sendJson(res, 200, { ok: true });
}

// Renova o access_token com o refresh_token (roda sozinho antes de cada consulta autenticada).
async function refreshSession(s) {
  if (!s.refreshToken) return false;
  try {
    const r = await fetch(OIDC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: OIDC_CLIENT, refresh_token: s.refreshToken }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) return false;
    const d = JSON.parse(await safeText(r));
    if (!d.access_token || !tokenOk(cleanToken(d.access_token))) return false;
    s.token = cleanToken(d.access_token);
    if (d.refresh_token) s.refreshToken = d.refresh_token; // a Globo pode girar o refresh_token
    s.expires = Date.now() + Math.max(60, ((num(d.expires_in) ?? 3600) - 30) * 1000);
    return true;
  } catch { return false; }
}

// ===== SAIR (logout): mata TUDO =====
// 1. Revoga o refresh_token na Globo (RFC 7009, /revoke): mesmo que a credencial tenha caído
//    em algum lugar, ela deixa de valer lá. Melhor esforço — uma falha de rede não impede o
//    logout, porque a sessão local já morre de qualquer jeito.
async function revogarTokenGlobo(refreshToken) {
  if (!refreshToken) return;
  try {
    await fetch(OIDC_BASE + "/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: new URLSearchParams({ client_id: OIDC_CLIENT, token: refreshToken, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(6000)
    });
  } catch { /* indiferente: sessão local já foi apagada */ }
}
// 2. Apaga o PERFIL do Chrome controlado (CHROME_PROFILE, padrão ~/.superliga-fabiao/chrome-globo):
//    é lá que ficam os cookies de SSO da Globo do login automático — sem isso, o próximo
//    "Entrar" entraria sem pedir a senha. Fecha qualquer navegador desses que esteja rodando,
//    espera o sistema soltar os arquivos e apaga a pasta. Devolve true se a pasta deixou de existir.
async function limparPerfilNavegador() {
  for (const p of procsNavegador) { try { p.kill(); } catch {} }
  await sleep(500);
  for (const p of procsNavegador) { try { if (p.exitCode === null) p.kill("SIGKILL"); } catch {} }
  procsNavegador.clear();
  if (autoAtual) { // login automático em andamento? encerra (o status dele vira erro no painel)
    const f = oidcFlows.get(autoAtual); if (f && f.auto && f.auto.close) f.auto.close();
    oidcFlows.delete(autoAtual); autoAtual = null;
  }
  await sleep(400); // Windows segura arquivos abertos por um instante depois do kill
  try { await fs.promises.rm(CHROME_PROFILE, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch {}
  try { return !fs.existsSync(CHROME_PROFILE); } catch { return true; }
}

// 3. A rota em si: rápida de chamar, todo o trabalho pesado está nas duas funções acima.
async function handleLogout(req, res) {
  // MATA TUDO: sessão local (token/refresh/id_token saem da memória), cookie do painel
  // expira, refresh_token revogado na Globo e perfil do navegador controlado apagado
  // (os cookies de SSO da Globo vão junto). Nada disso impede o logout se falhar.
  const sid = sessionIdFrom(req);
  const s = sid ? sessions.get(sid) : null;
  if (sid) sessions.delete(sid);
  const [perfilApagado] = await Promise.all([
    revogarTokenGlobo(s && s.refreshToken).then(() => true, () => false),
    limparPerfilNavegador()
  ]);
  // Endereço OFICIAL de logout da Globo (end-session do Keycloak): o painel abre numa
  // janelinha e ela apaga os cookies de SSO da Globo NO NAVEGADOR do usuário. Com
  // id_token_hint o logout é direto, sem página de confirmação.
  const fim = new URLSearchParams({ client_id: OIDC_CLIENT });
  if (s && s.idToken) fim.set("id_token_hint", s.idToken);
  return sendJson(res, 200, { loggedIn: false, globoLogoutUrl: OIDC_BASE + "/logout?" + fim, perfilApagado }, { "Set-Cookie": cookieHeader("", 0) });
}

async function proxyCartola(apiPath, res, session) {
  let hostIndex = 0;
  // Antes de cada consulta autenticada: se o access_token está perto de vencer (ou venceu),
  // renova sozinho com o refresh_token. Sem refresh ou com renovação falha e token vencido,
  // responde 401 para o painel pedir um novo login.
  if (session && apiPath.startsWith("/auth/")) {
    if (session.expires < Date.now() + 60000) {
      const ok = await refreshSession(session);
      if (!ok && session.expires < Date.now()) {
        return sendJson(res, 401, { error: "Sua sessão da Globo venceu e não pôde ser renovada. Entre de novo com a conta Globo.", needsRelogin: true });
      }
    }
  }
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
    if (parsed.pathname === "/auth/login-direto" && req.method === "POST") return handleLoginDireto(req, res);
    if (parsed.pathname === "/auth/oidc/start" && req.method === "POST") return handleOidcStart(req, res);
    if (parsed.pathname === "/auth/oidc/auto" && req.method === "POST") return handleOidcAuto(req, res);
    if (parsed.pathname === "/auth/oidc/auto/status" && req.method === "GET") return handleOidcAutoStatus(req, res);
    if (parsed.pathname === "/auth/oidc/auto/cancel" && req.method === "POST") return handleOidcAutoCancel(req, res);
    if (parsed.pathname === "/auth/oidc/go" && req.method === "GET") return handleOidcGo(req, res);
    if (parsed.pathname === "/auth/oidc/exchange" && req.method === "POST") return handleOidcExchange(req, res);
    if (parsed.pathname === "/auth/oidc/done" && req.method === "GET") return handleOidcDone(req, res);
    if (parsed.pathname === "/auth/me" && req.method === "GET") {
      const s = getSession(req);
      return sendJson(res, 200, { loggedIn: !!s, kind: s ? "oidc" : null, comRenovacao: !!(s && s.refreshToken), venceEm: s ? s.expires : null });
    }
    if (parsed.pathname === "/auth/logout" && req.method === "POST") return handleLogout(req, res);
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
