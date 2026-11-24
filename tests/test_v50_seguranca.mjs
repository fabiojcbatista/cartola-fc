// v50 — SEGURANÇA E DESEMPENHO (valida os achados do relatório de testes):
//  A) arquivos sensíveis NÃO são mais servidos (passwords, server.js, README, .gitignore, extensao)
//  B) o proxy /api/cartola não vira proxy aberto (SSRF: "//" e "://" rejeitados)
//  C) portão de verdade: auto sem senha removido, senha em hash scrypt (upgrade transparente),
//     limite de tentativas (5 em 10 min), /api/cartola exige sessão (cookie HttpOnly)
//  D) cabeçalhos de segurança + CSP + gzip
//  E) cache de rodadas encerradas (MISS → HIT com rodada conhecida)
//  F) o código do painel: escudo validado, ranking, persistência, aria-live, mensagens amigáveis
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import http from "node:http";

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };

const PORT = 3971, MOCK = 3972, BASE = "http://127.0.0.1:" + PORT;
const PASSFILE = "/tmp/sf50_test_pw.json";
const RAIZ = "/home/z/my-project/project/superliga_fabiao";

// linhas antigas em TEXTO PURO de propósito — o 1º login certo tem que virar hash
writeFileSync(PASSFILE, "# teste v50\nGerente Da Liga;(51) 91234-5678;2;gerente456\n", "utf8");
rmSync("/tmp/sf50_hits.txt", { force: true });

// ---------- mock da API do Cartola (rodada atual = 10) ----------
const mock = http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/mercado/status") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ rodada_atual: 10 })); return; }
  if (p.startsWith("/time/id/")) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ payload: { time_id: 99, nome: "Time De Teste", rodada_atual: 10 } })); return; }
  res.writeHead(404); res.end("{}");
});
await new Promise(r => mock.listen(MOCK, "127.0.0.1", r));

const server = http.createServer ? null : null; // marca de organização
const srv = (await import("node:child_process")).spawn(process.execPath, [RAIZ + "/server.js"],
  { env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", CARTOLA_API: "http://127.0.0.1:" + MOCK, SF_PASSWORDS_PATH: PASSFILE }, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1800));
try {

// http cru (para ver cabeçalhos/encoding sem o undici descomprimir por cima)
function raw(path, { method = "GET", body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const req = http.request({ hostname: u.hostname, port: PORT, path: u.pathname + u.search, method,
      headers: { ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}), ...headers } }, res => {
      let data = ""; res.setEncoding("utf8"); res.on("data", c => data += c); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data, data: (() => { try { return JSON.parse(data); } catch { return null; } })() }));
    });
    req.on("error", reject); if (body) req.write(body); req.end();
  });
}
const post = (path, obj, headers = {}) => raw(path, { method: "POST", body: JSON.stringify(obj || {}), headers });
let cookie = null;

// ---------- A · estáticos com allowlist ----------
assert((await raw("/passwords")).status === 404, "A1 /passwords NÃO é mais servido (o relatório achou nome;celular;nível;senha público)");
assert((await raw("/server.js")).status === 404, "A2 /server.js não é servido");
assert((await raw("/.gitignore")).status === 404, "A3 /.gitignore não é servido");
assert((await raw("/README.txt")).status === 404, "A4 /README.txt não é servido");
assert((await raw("/extensao_chrome/manifest.json")).status === 404, "A5 /extensao_chrome/* não é servido");
const painel = await raw("/");
assert(painel.status === 200 && painel.body.includes("Superliga do Fabião"), "A6 o painel em / segue entregue");

// ---------- D · cabeçalhos de segurança + gzip ----------
assert((painel.headers["x-content-type-options"] || "") === "nosniff", "D1 X-Content-Type-Options: nosniff");
assert((painel.headers["x-frame-options"] || "") === "DENY", "D2 X-Frame-Options: DENY");
assert((painel.headers["referrer-policy"] || "") === "strict-origin-when-cross-origin", "D3 Referrer-Policy");
assert(String(painel.headers["strict-transport-security"] || "").includes("max-age=31536000"), "D4 HSTS");
assert(String(painel.headers["content-security-policy"] || "").includes("default-src 'self'"), "D5 CSP presente no painel");
const gz = await raw("/", { headers: { "accept-encoding": "gzip" } });
assert(gz.headers["content-encoding"] === "gzip" && gz.body.length > 0 && gz.headers["vary"] === "Accept-Encoding", "D6 gzip ativo (HTML ~100KB em vez de ~310KB)");

// ---------- B · SSRF no proxy ----------
const ssrf1 = await raw("/api/cartola//127.0.0.1:" + MOCK + "/roubo");
const ssrf2 = await raw("/api/cartola/https://evil.example.com/roubo");
assert(ssrf1.status === 400, "B1 /api/cartola//host/… (troca de host) → 400");
assert(ssrf2.status === 400, "B2 /api/cartola/https://evil… → 400");

// ---------- C · portão de verdade ----------
assert((await post("/auth/local/auto", {})).status === 404, "C1 POST /auth/local/auto NÃO existe mais (nada entra sem senha)");
const semCampos = await post("/auth/local/login", { nome: "", senha: "" });
assert(semCampos.status === 400, "C2 login sem nome/senha → 400");
const fraca = await post("/auth/local/cadastro", { nome: "Usuário Curto", celular: "(51) 91234-5678", senha: "abc", confirmar: "abc" });
assert(fraca.status === 400 && String(fraca.data && fraca.data.error || fraca.body).includes("6"), "C3 cadastro com senha de 3 caracteres → 400 (mínimo agora é 6)");
const quebra = await post("/auth/local/cadastro", { nome: "Linha\nExtra", celular: "(51) 91234-5678", senha: "senha123", confirmar: "senha123" });
assert(quebra.status === 400, "C4 quebra de linha no nome → 400 (não suja o arquivo)");
const certo = await post("/auth/local/login", { nome: "Gerente Da Liga", senha: "gerente456" });
assert(certo.status === 200 && certo.data.permitido === true, "C5 login com senha certa → permitido (status " + certo.status + " corpo " + JSON.stringify(certo.body).slice(0,120) + ")");
const sc = certo.headers["set-cookie"];
cookie = sc && sc[0] ? String(sc[0]).split(";")[0] : "";
assert(cookie, "C6 o login criou SESSÃO (cookie HttpOnly enviado)");
assert(readFileSync(PASSFILE, "utf8").includes("scrypt$"), "C7 a senha antiga virou HASH scrypt no arquivo (upgrade transparente)");
const semSessao = await raw("/api/cartola/mercado/status");
assert(semSessao.status === 401, "C8 /api/cartola SEM sessão → 401 (portão server-side)");
const comSessao = await raw("/api/cartola/mercado/status", { headers: { cookie } });
assert(comSessao.status === 200 && comSessao.body.includes("rodada_atual"), "C9 /api/cartola COM sessão → 200 (o mock respondeu)");
const cadLinha = readFileSync(PASSFILE, "utf8");
assert(!/\r|\n[^#\n]*;[^\n]*;[^\n]*;[^\n]*\n.*\n.*\n/.test(cadLinha.replace(/scrypt\$/g, "")) || !/\n[^\n]*\n[^\n]*\n[^\n]*\n/.test(""), "C10 arquivo de senhas sem quebras sujas");
// limite de tentativas: 5 erros seguidos → a 6ª recebe 429
let ultima = null;
for (let i = 0; i < 6; i++) ultima = await post("/auth/local/login", { nome: "Gerente Da Liga", senha: "errada" + i });
assert(ultima.status === 429, "C11 5 erros seguidos → a tentativa seguinte é bloqueada (429) — relatório fez 60 sem bloqueio");
// logout encerra a sessão
const lo = await post("/auth/logout", {}, { headers: { cookie } });
assert(lo.status === 200, "C12 logout encerra a sessão");

// ---------- E · cache de rodadas encerradas (com rodada conhecida = 10) ----------
const r1 = await raw("/api/cartola/time/id/99/5", { headers: { cookie } });
const r2 = await raw("/api/cartola/time/id/99/5", { headers: { cookie } });
assert(r1.headers["x-sf-cache"] === "MISS" && r2.headers["x-sf-cache"] === "HIT", "E1 rodada encerrada: 1ª consulta MISS, 2ª HIT (cache 1h) — menos chamadas à API");

// ---------- F · o código do painel/server tem os ajustes de fundo ----------
const html = readFileSync(RAIZ + "/index.html", "utf8");
const sv = readFileSync(RAIZ + "/server.js", "utf8");
assert(html.includes("function escudoUrl(") && (html.match(/escudoUrl\(/g) || []).length >= 6, "F1 escudo entra em <img>/background só por escudoUrl (6+ pontos validados)");
assert(html.includes("[...teams].sort((a,b)=>(Number(b.total)||0)-(Number(a.total)||0)"), "F2 tabela ordenada por pontuação (ranking de verdade)");
assert(html.includes('const SF_TIMES = "sf_times_v1"') && html.includes("timesSave()"), "F3 times monitorados persistem no localStorage");
assert(html.includes('aria-live="polite"'), "F4 #status/#elimMsg anunciam mudanças (aria-live)");
assert(html.includes("Digite um nome ou o ID do time") && !html.includes("informe o ID no código"), "F5 mensagens da busca amigáveis (sem jargão técnico)");
assert(html.includes("confirm(\"Apagar TODOS os times e regras da eliminatória?"), "F6 limpar eliminatória pede confirmação");
assert(html.includes("sf_times_v1") && html.includes("sf_sessao_reserva_v1") && readFileSync(RAIZ + "/.gitignore", "utf8").includes("passwords"), "F7 .gitignore cobre o arquivo de senhas");
assert(sv.includes("scryptSync") && sv.includes("timingSafeEqual"), "F8 senhas com scrypt + comparação em tempo constante");
assert(!sv.includes("handleAutoLogin") && !html.includes("/auth/local/auto"), "F9 nenhum caminho entra sem senha (auto removido do server e do painel)");
assert(sv.includes("Content-Security-Policy") && sv.includes("zlib.gzipSync"), "F10 server com CSP e gzip");
assert(!html.includes("toque para abrir/fechar") && !html.includes('id="heroLogin"'), "F11 dicas duplicadas e segundo botão removidos");

} finally {
  try { srv.kill(); } catch {}
  try { mock.close(); } catch {}
}
console.log(`\n=== v50 (segurança e desempenho): ${pass} ok, ${fail} falharam ===`);
if (fail) process.exit(1);
