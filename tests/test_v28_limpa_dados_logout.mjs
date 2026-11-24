// =====================================================================
// Bateria v28 — O SAIR LIMPA TAMBÉM OS TIMES BUSCADOS (estado de fábrica).
// Até a v27, o Sair removia só o time vindo do login; os times adicionados
// pelo campo “Buscar time” ficavam na lista, com pontuações. A v28 manda
// TUDO embora: a lista de times volta a ZERO e as tabelas voltam a orientar.
//
// Esta bateria roda o <script> REAL do index.html (stubs de DOM/fetch) e
// exercita o doLogout() COMPLETO (o mesmo clique do botão “Sair”):
//   A · Cena real: login recoloca o time da conta + UMA liga clássica
//       carregada da conta + um time buscado à mão com pontuações.
//   B · doLogout(): lista vai a ZERO (login E buscado), pontuações sumiram,
//       dados brutos da conta (ligas/competições) saem da memória, tabelas
//       voltam à orientação, métrica a 0, authbox volta a “Entrar com Globo”.
//   C · A janelinha oficial de logout da Globo é aberta (end-session URL com
//       client_id) e o status conta o que foi limpo.
//   D · Idempotente: clicar em Sair de novo não quebra nada.
// O servidor continua fazendo a parte dele como na v25 (test_logout_v25.mjs,
// 40 verificações — sessão, cookie, revogação do token e perfil do navegador).
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

// ---------- stubs ----------
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, innerHTML: "", textContent: "", className: "", value: "34-38",
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(){}, showModal(){}, close(){}, open: false, disabled: false, select(){},
  });
  return els.get(id);
}
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.document = { getElementById: el, querySelectorAll: () => [] };
globalThis.window = globalThis;
globalThis.location = { origin: "http://localhost:3000" };
try { globalThis.navigator = {}; } catch {}

// ---------- mundo simulado ----------
const MY = 1382686, MY_NOME = "Super Fabiao PRO FC", MY_SLUG = "super-fabiao-pro-fc";
const OUTRO = 777, OUTRO_NOME = "Outro Time FC";
let world = { rodada: 35, loggedIn: false };
let calls = [];
const janelasAbertas = []; // window.open(url, …)
function jsonResponse(obj) { return { ok: true, status: 200, json: async () => obj }; }
globalThis.window.open = (url, nome) => { janelasAbertas.push({ url, nome }); return { closed: false, close(){} }; };
globalThis.fetch = async (url, opts) => {
  const u = String(url); calls.push(u);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  if (path === "/auth/me") return jsonResponse({ loggedIn: world.loggedIn });
  if (path === "/auth/time") {
    if (!world.loggedIn) return { ok: false, status: 401, json: async () => ({}) };
    return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: MY_SLUG } });
  }
  if (path === "/auth/logout") return jsonResponse({ loggedIn: false, globoLogoutUrl: "https://auth.globo.com/logout?client_id=cartola-web%40apps.globoid", perfilApagado: true });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: world.rodada, temporada: 2026 });
  if (path.startsWith("/time/id/")) {
    const partes = path.split("/"); // ["", "time", "id", "{id}", "{rodada}"]
    const id = Number(partes[3]), r = Number(partes[4]);
    const nome = id === MY ? MY_NOME : OUTRO_NOME;
    const p = id === MY ? 60 + r : 10;
    return jsonResponse({ time: { nome }, pontos: { rodada: p } });
  }
  if (path === "/times" || path === "/busca") {
    const q = decodeURIComponent((u.split("?")[1] || "").replace(/^q=/, ""));
    if (q.toLowerCase().includes("outro")) return jsonResponse({ times: [{ time_id: OUTRO, nome: OUTRO_NOME, slug: "outro-time-fc" }] });
    return jsonResponse({ times: [] });
  }
  if (path === "/auth/ligas") {
    if (!world.loggedIn) return { ok: false, status: 401, json: async () => ({}) };
    return jsonResponse({ ligas: [{ slug: "liga-clas-a", nome: "Liga Clássica A", mata_mata: false, inicio_rodada: 1, fim_rodada: 38, total_times_liga: 10 }] });
  }
  if (path.startsWith("/auth/liga/")) {
    return jsonResponse({ liga: { slug: "liga-clas-a", nome: "Liga Clássica A", mata_mata: false, inicio_rodada: 1, fim_rodada: 38, total_times_liga: 10 },
      times: [{ time_id: MY, nome: MY_NOME, pontos: { campeonato: 900, rodada: 70 }, ranking: { campeonato: 1 } }] });
  }
  if (path === "/auth/competicoes/pontoscorridos") return jsonResponse([]);
  return { ok: false, status: 404, json: async () => ({}) };
};

// ---------- helpers ----------
function extract() {
try{globalThis.__SF_ACESSO_PRESET={nivel:2,nome:"Fabio Batista"}}catch{} // v41: injeção de acesso para os testes (em uso real, toda carga pede login)
  const fn = new Function(src + "\n;return { teams:()=>teams, leagues:()=>leagues, pcLeagues:()=>pcLeagues, loggedIn:()=>loggedIn, brutas:()=>window.__ligasBrutas, pcBrutas:()=>window.__pcBrutas, doLogout, addSearchTeam, renderAuth, render };");
  return fn();
}
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const waitStatus = async (substr) => {
  for (let i = 0; i < 400; i++) {
    await new Promise(r => setTimeout(r, 25));
    if (has(el("status").textContent, substr)) return;
  }
  throw new Error("status esperado não apareceu: " + substr);
};
const waitTeams = async (api, n) => {
  for (let i = 0; i < 400; i++) {
    await new Promise(r => setTimeout(r, 25));
    if (api.teams().length === n) return;
  }
  throw new Error("esperado " + n + " time(s); tenho " + api.teams().length);
};

console.log("=== A · Cena real: login + liga da conta + time buscado ===");
world.loggedIn = true;
let api = extract(); // boot real: /auth/me true → syncMyTeam entra com o time da conta
await waitStatus("Conexão concluída");
assert(api.teams().length === 1 && api.teams()[0].mine === true, "A1 time da conta entrou sozinho no login");
assert(api.leagues().length === 1 && api.leagues()[0].slug === "liga-clas-a", "A2 liga clássica da conta carregada (1 liga na memória)");
assert(api.brutas() !== null, "A3 dados brutos de ligas estão na memória da página");
el("searchInput").value = OUTRO_NOME;
await api.addSearchTeam();
await waitTeams(api, 2);
assert(api.teams().length === 2, "A4 time buscado também está na lista (2 times)");
assert(has(el("bannerResumo").innerHTML, OUTRO_NOME) && has(el("bannerResumo").innerHTML, MY_NOME), "A5 os dois aparecem no banner-resumo");

console.log("=== B · doLogout(): a lista vai a ZERO e a página volta ao estado de fábrica ===");
await api.doLogout();
assert(api.teams().length === 0, "B1 lista de times VAZIA após o Sair (login E buscado saíram)");
assert(api.leagues().length === 0, "B2 ligas da conta saíram da memória");
assert(api.brutas() === null && api.pcBrutas() === null, "B3 dados brutos (ligas/competições) zerados");
assert(api.loggedIn() === false, "B4 loggedIn false");
assert(String(el("metricTeams").textContent) === "0", "B5 métrica 'Times monitorados' voltou a 0");
assert(has(el("bannerResumo").innerHTML, "Nenhum time monitorado ainda"), "B6 o banner volta à orientação");
assert(!has(el("scoresTable").innerHTML, MY_NOME) && !has(el("scoresTable").innerHTML, OUTRO_NOME), "B7 pontuações dos dois times sumiram da tabela");
assert(has(el("scoresTable").innerHTML, "Nenhum time monitorado"), "B8 tabela de pontuação orienta em vez de ficar em branco");
assert(has(el("classicTable").innerHTML, "Faça login com a Globo"), "B9 tabela de ligas pede login de novo");
assert(has(el("authBox").innerHTML, "Entrar com Globo") && !has(el("authBox").innerHTML, "Sair"), "B10 authbox voltou a 'Entrar com Globo'");

console.log("=== C · Janelinha oficial da Globo + status contando o que foi limpo ===");
const globo = janelasAbertas.find(j => /auth\.globo\.com\/logout/.test(j.url));
assert(!!globo, "C1 a página OFICIAL de logout da Globo foi aberta numa janelinha");
assert(!!globo && globo.url.includes("client_id=cartola-web%40apps.globoid"), "C2 a URL de end-session leva o client_id do painel");
assert(has(el("status").textContent, "voltou a zero") && has(el("status").textContent, "times limpos"), "C3 status informa que os times (inclusive os buscados) foram limpos");
assert(has(el("status").textContent, "token revogado"), "C4 status informa a revogação do token (v25 mantida)");

console.log("=== D · Idempotência: Sair de novo não quebra nada ===");
calls = [];
await api.doLogout();
assert(api.teams().length === 0 && api.loggedIn() === false, "D1 segundo Sair mantém o estado limpo (sem erro)");
assert(janelasAbertas.length >= 2, "D2 a janelinha da Globo é aberta de novo (nada travado)");

console.log(`\nResultado: ${pass} ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
