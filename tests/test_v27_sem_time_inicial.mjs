// =====================================================================
// Bateria v27 — SEM TIME PRÉ-CASTRADO no painel Superliga do Fabião.
// O que mudou: INITIAL_TEAMS ficou VAZIO (o “Super Fabiao PRO FC” fixo no
// código saiu). Os times agora entram só por: LOGIN (o time da conta entra
// sozinho via syncMyTeam) e BUSCA manual (campo “Buscar time”).
//
// O que esta bateria garante (roda o <script> REAL do index.html em stubs):
//   A · Boot sem login: nenhum time é carregado por conta própria — nenhuma
//       chamada /time/id/, nenhuma busca automática; lista e tabela mostram
//       orientação (não ficam em branco); a rodada atual continua aparecendo.
//   B · Boot com sessão ativa (auth/me loggedIn): o time da conta entra
//       sozinho (mine+fromLogin), o histórico carrega e as ligas passam a
//       carregar (mineId volta a existir) — sem time fixo no código.
//   C · Busca manual sem login adiciona e monitora qualquer time.
//   D · Sair/remove estado de login: TODOS os times saem — o do login E os buscados —
//       com as pontuações (contrato atualizado pela v28: antes, os buscados ficavam).
//   E · Estrutura: INITIAL_TEAMS é [] e o código não traz mais time fixo.
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
let world = { rodada: 35, loggedIn: false, pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
let calls = [];
function jsonResponse(obj) { return { ok: true, status: 200, json: async () => obj }; }
globalThis.fetch = async (url) => {
  const u = String(url); calls.push(u);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  if (path === "/auth/me") return jsonResponse({ loggedIn: world.loggedIn });
  if (path === "/auth/time") {
    if (!world.loggedIn) return { ok: false, status: 401, json: async () => ({}) };
    return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: MY_SLUG } });
  }
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: world.rodada, temporada: 2026 });
  if (path.startsWith("/time/id/")) {
    const partes = path.split("/"); // ["", "time", "id", "{id}", "{rodada}"]
    const id = Number(partes[3]), r = Number(partes[4]);
    const nome = id === MY ? MY_NOME : OUTRO_NOME;
    const p = id === MY ? world.pontosPorRodada(r) : world.outroPontos(r);
    return jsonResponse({ time: { nome }, pontos: { rodada: p } });
  }
  if (path === "/times" || path === "/busca") {
    const q = decodeURIComponent((u.split("?")[1] || "").replace(/^q=/, ""));
    if (q.toLowerCase().includes("outro")) return jsonResponse({ times: [{ time_id: OUTRO, nome: OUTRO_NOME, slug: "outro-time-fc" }] });
    return jsonResponse({ times: [] });
  }
  if (path === "/auth/ligas") return jsonResponse({ ligas: [] });
  if (path === "/auth/competicoes/pontoscorridos") return jsonResponse([]);
  return { ok: false, status: 404, json: async () => ({}) };
};

// ---------- helpers ----------
function extract() {
try{globalThis.__SF_ACESSO_PRESET={nivel:2,nome:"Fabio Batista"}}catch{} // v41: injeção de acesso para os testes (em uso real, toda carga pede login)
  const fn = new Function(src + "\n;return { teams:()=>teams, INITIAL_TEAMS:()=>INITIAL_TEAMS, loggedIn:()=>loggedIn, brutas:()=>window.__ligasBrutas, pcBrutas:()=>window.__pcBrutas, addSearchTeam, dropLoginState, renderAuth, render, refreshAll };");
  return fn();
}
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const waitStatus = async (api, substr) => {
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
const fmt = v => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

console.log("=== A · Boot SEM login: começa vazio, com orientação ===");
calls = [];
let api = extract(); // dispara o boot real (IIFE)
await waitStatus(api, "Nenhum time monitorado ainda");
assert(api.teams().length === 0, "A1 lista de times começa VAZIA (nenhum time fixo no boot)");
assert(String(el("metricTeams").textContent) === "0", "A2 métrica 'Times monitorados' mostra 0");
assert(has(el("bannerResumo").innerHTML, "Nenhum time monitorado ainda") && has(el("bannerResumo").innerHTML, "Entre com a Globo"), "A3 o banner-resumo mostra ORIENTAÇÃO (entre com a Globo / buscar time)");
assert(has(el("scoresTable").innerHTML, "Nenhum time monitorado") && has(el("scoresTable").innerHTML, "colspan"), "A4 tabela de pontuação vazia mostra orientação (não fica em branco)");
assert(!calls.some(u => u.includes("/time/id/")), "A5 NENHUMA chamada /time/id/ no boot sem login (não consulta time fixo)");
assert(!calls.some(u => u.includes("/times?q=")), "A6 nenhuma busca automática de time no boot");
assert(!calls.some(u => u.includes("/auth/ligas")), "A7 sem login, ligas NÃO são consultadas (comportamento mantido)");
assert(has(el("marketRound").textContent, "35"), "A8 a rodada atual (35) continua sendo mostrada com a lista vazia");
assert(el("status").className.includes("ok"), "A9 status final com a orientação é 'ok' (não é erro)");
assert(has(el("status").textContent, "entre com a Globo"), "A10 status orienta: entre com a Globo ou busque um time");
assert(has(el("classicTable").innerHTML, "Faça login com a Globo"), "A11 tabela clássica pede login (comportamento mantido)");
assert(has(el("authBox").innerHTML, "Entrar com Globo") && !has(el("authBox").innerHTML, "Sair"), "A12 authbox mostra 'Entrar com Globo' (deslogado)");

console.log("=== B · Boot COM sessão ativa: o time da conta entra sozinho ===");
els.clear(); store.clear();
world.loggedIn = true;
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída");
assert(api.teams().length === 1, "B1 com login, o time da conta entra SOZINHO na lista (1 time)");
const t0 = api.teams()[0];
assert(t0.id === MY && t0.mine === true && t0.fromLogin === true, "B2 time vindo do login é marcado mine+fromLogin (id " + MY + ")");
assert(t0.name === MY_NOME, "B3 nome do time vem da API (/auth/time): " + MY_NOME);
assert(has(el("bannerResumo").innerHTML, "MEU TIME"), "B4 o banner-resumo exibe o cartão do MEU TIME");
assert(has(el("authBox").innerHTML, "Conectado") && has(el("authBox").innerHTML, MY_NOME), "B5 authbox mostra 'Conectado como Super Fabiao PRO FC'");
const esperado = Array.from({ length: world.rodada }, (_, i) => 60 + (i + 1)).reduce((a, b) => a + b, 0);
assert(has(el("scoresTable").innerHTML, fmt(esperado)), "B6 histórico do time carregou (total " + fmt(esperado) + " = soma das 35 rodadas)");
assert(calls.some(u => u.includes("/auth/ligas")), "B7 ligas passam a carregar (mineId existe de novo após o login)");
assert(has(el("classicNote").textContent, "Nenhuma liga deste tipo foi encontrada na sua conta."), "B8 conta sem ligas: recado oficial (não é erro)");

console.log("=== C · Busca manual SEM login: qualquer time entra pelo campo ===");
els.clear(); store.clear();
world.loggedIn = false;
calls = [];
api = extract();
await waitStatus(api, "Nenhum time monitorado ainda");
el("searchInput").value = OUTRO_NOME;
await api.addSearchTeam();
await waitStatus(api, "Conexão concluída");
assert(api.teams().length === 1 && String(api.teams()[0].id) === String(OUTRO), "C1 busca adicionou " + OUTRO_NOME + " (id " + OUTRO + ")");
assert(api.teams()[0].mine === undefined, "C2 time buscado NÃO é marcado como 'meu time'");
assert(has(el("bannerResumo").innerHTML, OUTRO_NOME), "C3 o banner-resumo mostra o time buscado");
assert(has(el("scoresTable").innerHTML, fmt(350)), "C4 pontuação do time buscado carregou (10 pts × 35 rodadas = 350,00)");
assert(has(el("metricTeams").textContent, "1"), "C5 métrica atualizou para 1");
// duplicado não entra duas vezes
calls = [];
el("searchInput").value = OUTRO_NOME;
await api.addSearchTeam();
await new Promise(r => setTimeout(r, 100));
assert(api.teams().length === 1, "C6 buscar o MESMO time de novo não duplica ('Esse time já está cadastrado')");
assert(has(el("status").textContent, "já está cadastrado"), "C7 aviso de time duplicado aparece no status");

console.log("=== D · Sair/remove login: TODOS os times saem (v28: estado de fábrica) ===");
els.clear(); store.clear();
world.loggedIn = true;
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída"); // login → time da conta entra
el("searchInput").value = OUTRO_NOME;
await api.addSearchTeam();                  // + time buscado
await waitTeams(api, 2);
assert(api.teams().length === 2, "D1 cena montada: 1 time do login + 1 buscado");
api.dropLoginState();
api.renderAuth(); api.render();
assert(api.teams().length === 0, "D2 ao deslogar, a lista vai a ZERO (time do login E buscados saem)");
assert(api.loggedIn() === false, "D3 loggedIn volta a false");
assert(has(el("bannerResumo").innerHTML, "Nenhum time monitorado ainda"), "D4 o banner volta à orientação de estado vazio");
assert(!has(el("scoresTable").innerHTML, MY_NOME) && !has(el("scoresTable").innerHTML, OUTRO_NOME) && has(el("scoresTable").innerHTML, "Nenhum time monitorado"), "D5 pontuações dos dois times sumiram da tabela (volta a orientar)");
assert(String(el("metricTeams").textContent) === "0", "D6 métrica volta a 0");
assert(api.brutas() === null && api.pcBrutas() === null, "D7 dados brutos da conta (ligas/competições) saem da memória da página");

console.log("=== E · Estrutura do código (v27 no arquivo) ===");
assert(Array.isArray(api.INITIAL_TEAMS()) && api.INITIAL_TEAMS().length === 0, "E1 INITIAL_TEAMS é uma lista VAZIA (nenhum time de fábrica)");
assert(!/\{\s*name\s*:\s*["']Super Fabiao/.test(src), "E2 o objeto do time fixo 'Super Fabiao PRO FC' não existe mais no código");
assert(!/id\s*:\s*1382686\s*[,}]/.test(src), "E3 o id fixo 1382686 não é mais cadastrado no código");
assert(has(src, "const INITIAL_TEAMS = [];"), "E4 INITIAL_TEAMS permanece como variável (documentada) para quem quiser um time fixo");
assert(!has(html, "1 TIME • 3 MODALIDADES") && !has(html, 'class="side-note"'), "E5 (atualizado na v35) o selo lateral foi aposentado a pedido — e a contagem antiga de time não voltou");
assert(has(html, 'id="metricTeams">0<'), "E6 métrica estática do cabeçalho começa em 0");
assert(has(src, "team-empty"), "E7 CSS do estado vazio da lista existe");

console.log(`\nResultado: ${pass} ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
