// =====================================================================
// Bateria v30 — MOBILE/WEB + TODAS AS RODADAS no painel Superliga do Fabião.
// O que mudou: (1) BANNER-RESUMO — “Meu time” + times cadastrados (nome e
// total) aparecem DIRETO no cabeçalho; o restante (lista detalhada, ligas,
// pontuação por rodada) virou seções OCULTAS (details.fold) que abrem com um
// toque — fechadas no celular, abertas na tela larga, escolha guardada.
// (2) O seletor de janelas de rodadas saiu: a tabela SEMPRE mostra todas as
// rodadas, de 1 até a última com pontuação. (3) REGRA DA RODADA — a pontuação
// vai ATÉ A RODADA EM ANDAMENTO (parcial incluído); com o mercado ABERTO
// (ou fechado, antes da bola rolar), vai até a ANTERIOR.
//
// O que esta bateria garante (roda o <script> REAL do index.html em stubs):
//   A · Estrutura: bannerResumo + 3 folds no HTML; roundRange e <aside> fora;
//       CSS do banner e dos folds presente; comentário v30 no topo.
//   B · Boot vazio: banner orienta; nenhuma chamada /time/id/.
//   C · Mercado ABERTO (status 1, rodada 35): busca 1..34 (NUNCA a 35), total
//       = soma 1..34, tabela termina em Rdd 34, banner mostra Meu time + total,
//       status explica “vale a anterior”.
//   D · Mercado EM ANDAMENTO (status 4): busca até a 35 (parcial entra), tabela
//       termina em Rdd 35, status diz “EM ANDAMENTO … parcial”.
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina
//   E · Mercado FECHADO (status 2): igual ao aberto — até a anterior (34).
//   F · Só time buscado (sem login): banner tem cartão fantasma + chip com total.
//   G · Folds: padrão aberto na tela larga; fechado no estreito; preferência
//       lida do localStorage e GRAVADA ao alternar.
//   H · Temporada nova (aberto, rodada 1): limite 0 não é erro — aguarda a 1ª rodada.
// =====================================================================
import { readFileSync } from "node:fs";

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

// ---------- stubs ----------
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, innerHTML: "", textContent: "", className: "", value: "",
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(type, fn){ (this._ls ??= {})[type] = fn; },
    showModal(){}, close(){}, open: false, disabled: false, select(){},
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
let world = {
  rodada: 35, loggedIn: false, statusMercado: 1, obs: "Mercado Aberto",
  pontosPorRodada: r => 60 + r, outroPontos: () => 10,
};
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
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: world.rodada, temporada: 2026, status_mercado: world.statusMercado, status_mercado_obs: world.obs });
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
  const fn = new Function(src + "\n;return { teams:()=>teams, limiteRodada:()=>limiteRodada, mercadoParcial:()=>mercadoParcial, currentRound:()=>currentRound, roundColumns, renderResumo, addSearchTeam, dropLoginState, renderAuth, render, refreshAll, foldPrefs };");
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
const reset = () => { els.clear(); store.clear(); delete globalThis.matchMedia; };

console.log("=== A · Estrutura do v30 no arquivo ===");
assert(has(html, 'id="bannerResumo"'), "A1 o cabeçalho tem a área do banner-resumo (bannerResumo)");
assert(has(html, 'id="foldLigas"') && has(html, 'id="foldScores"'), "A2 as seções ocultas (details.fold) existem: ligas e pontuação — os times ficam no banner (v46)");
assert(has(html, 'id="roundRange"'), "A3 (atualizado na v31) o controle de rodadas EXIBIDAS voltou ao HTML — os dados seguem sempre completos");
assert(!has(html, "<aside"), "A4 a coluna lateral (<aside>) saiu — layout de uma coluna só");
assert(has(src, "function renderResumo()") && has(src, "renderLeagues();renderResumo()"), "A5 o render agora também pinta o banner-resumo");
assert(has(src, "let limiteRodada") && has(src, "mercadoParcial"), "A6 o limite de rodadas e o estado do mercado existem no código");
assert(has(src, "limiteRodada=mercadoParcial?currentRound:currentRound-1"), "A7 a regra da rodada está no código (em andamento = atual; aberto/fechado = anterior)");
assert(has(html, "v30 — MOBILE/WEB + TODAS AS RODADAS"), "A8 comentário v30 no cabeçalho do painel (a cadeia v29 e anteriores segue abaixo)");
assert(has(html, ".me-card") && has(html, "details.fold>summary"), "A9 CSS do banner-resumo e dos folds presente");

console.log("=== B · Boot vazio: o banner orienta (mobile/web) ===");
reset();
world = { rodada: 35, loggedIn: false, statusMercado: 1, obs: "Mercado Aberto", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
let api = extract();
await waitStatus(api, "Nenhum time monitorado ainda");
assert(api.teams().length === 0, "B1 boot sem time (comportamento da v27 mantido)");
assert(has(el("bannerResumo").innerHTML, "Nenhum time monitorado ainda") && has(el("bannerResumo").innerHTML, "Entre com a Globo"), "B2 o BANNER orienta quando não há times (a informação essencial está no topo)");
assert(has(el("bannerResumo").innerHTML, "Buscar time"), "B3 o banner aponta para a busca logo abaixo");
assert(!calls.some(u => u.includes("/time/id/")), "B4 nenhuma chamada /time/id/ no boot vazio");
assert(has(el("status").textContent, "Rodada 35 carregada (Mercado Aberto)"), "B5 status mostra a rodada e a situação do mercado");
assert(has(el("scoresLimite").textContent, "Rodadas 1–34"), "B6 subtítulo da tabela já mostra o limite: mercado aberto → rodadas 1–34");
assert(api.limiteRodada() === 34 && api.mercadoParcial() === false, "B7 limiteRodada=34 e mercadoParcial=false com mercado aberto na rodada 35");

console.log("=== C · Mercado ABERTO (rodada 35): histórico até a ANTERIOR (34) ===");
reset();
world = { rodada: 35, loggedIn: true, statusMercado: 1, obs: "Mercado Aberto", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída");
await waitTeams(api, 1);
const esperadoC = Array.from({ length: 34 }, (_, i) => 61 + i).reduce((a, b) => a + b, 0);
assert(api.teams()[0].id === MY && api.teams()[0].mine === true, "C1 o time da conta entrou sozinho (mine)");
assert(api.limiteRodada() === 34, "C2 limite = 34 (mercado aberto: a rodada 35 ainda não pontuou)");
assert(!calls.some(u => u.includes("/time/id/" + MY + "/35")), "C3 a rodada 35 (futura) NUNCA é consultada com o mercado aberto");
assert(calls.some(u => u.includes("/time/id/" + MY + "/34")) && calls.some(u => u.includes("/time/id/" + MY + "/1")), "C4 todas as rodadas 1..34 são consultadas (sempre TODAS, sem janela)");
assert(api.teams()[0].total === esperadoC, "C5 total = soma das 34 rodadas (" + fmt(esperadoC) + ") — sem a rodada futura");
assert(api.roundColumns().length === 34 && api.roundColumns()[0] === 1 && api.roundColumns()[33] === 34, "C6 roundColumns devolve 1..34 (todas as rodadas, de 1 até o limite)");
assert(has(el("scoresTable").innerHTML, "Rdd 34") && !has(el("scoresTable").innerHTML, "Rdd 35"), "C7 a tabela vai até Rdd 34 e não mostra coluna futura");
assert(has(el("scoresTable").innerHTML, fmt(esperadoC)), "C8 a pontuação acumulada aparece na tabela");
assert(has(el("bannerResumo").innerHTML, "⭐ MEU TIME") && has(el("bannerResumo").innerHTML, MY_NOME), "C9 o BANNER mostra o Meu time (nome no cartão dourado)");
assert(has(el("bannerResumo").innerHTML, fmt(esperadoC)), "C10 o BANNER mostra o total do Meu time (" + fmt(esperadoC) + " pts)");
assert(has(el("bannerResumo").innerHTML, "Rodada 35 • Mercado Aberto"), "C11 o cartão do Meu time mostra a rodada e a situação do mercado");
assert(has(el("bannerResumo").innerHTML, "MEU TIME"), "C12 o banner-resumo mantém o cartão do MEU TIME");
assert(has(el("status").textContent, "até a rodada 34") && has(el("status").textContent, "vale a anterior"), "C13 o status explica a regra: mercado aberto → vale a anterior");

console.log("=== D · Mercado EM ANDAMENTO (rodada 35): parcial da rodada ENTRA ===");
reset();
world = { rodada: 35, loggedIn: true, statusMercado: 4, obs: "Em andamento", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída");
await waitTeams(api, 1);
const esperadoD = esperadoC + 95;
assert(api.limiteRodada() === 35 && api.mercadoParcial() === true, "D1 limite = 35 e mercadoParcial=true (a rodada está em andamento)");
assert(calls.some(u => u.includes("/time/id/" + MY + "/35")), "D2 a rodada EM ANDAMENTO (35) é consultada — o parcial entra");
assert(!calls.some(u => u.includes("/time/id/" + MY + "/36")), "D3 a rodada 36 (futura) não é consultada");
assert(api.teams()[0].total === esperadoD, "D4 total inclui o parcial da rodada 35 (" + fmt(esperadoD) + ")");
assert(has(el("scoresTable").innerHTML, "Rdd 35") && !has(el("scoresTable").innerHTML, "Rdd 36"), "D5 a tabela vai até Rdd 35 (última em andamento)");
assert(has(el("status").textContent, "EM ANDAMENTO") && has(el("status").textContent, "parcial"), "D6 o status diz que o parcial da rodada em andamento entra na soma");
assert(has(el("bannerResumo").innerHTML, "Rodada 35 • Em andamento"), "D7 o cartão do Meu time reflete 'Em andamento'");

console.log("=== E · Mercado FECHADO (rodada 35, antes da bola rolar): até a ANTERIOR ===");
reset();
world = { rodada: 35, loggedIn: true, statusMercado: 2, obs: "Fechado", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída");
assert(api.limiteRodada() === 34, "E1 limite = 34 (mercado fechado: a rodada 35 ainda não começou)");
assert(!calls.some(u => u.includes("/time/id/" + MY + "/35")), "E2 a rodada 35 não é consultada");
assert(has(el("status").textContent, "vale a anterior"), "E3 o status explica a regra");

console.log("=== F · Só time buscado (sem login): banner com cartão fantasma + cartão do time (v36) ===");
reset();
world = { rodada: 35, loggedIn: false, statusMercado: 1, obs: "Mercado Aberto", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
api = extract();
await waitStatus(api, "Nenhum time monitorado ainda");
el("searchInput").value = "Outro Time FC";
await api.addSearchTeam();
await waitStatus(api, "Conexão concluída");
await waitTeams(api, 1);
assert(api.teams()[0].id === OUTRO && !api.teams()[0].mine, "F1 o time buscado entrou na lista (sem login)");
assert(has(el("bannerResumo").innerHTML, "Entre com a Globo") && has(el("bannerResumo").innerHTML, "o time da sua conta entra sozinho"), "F2 o banner mostra o cartão fantasma do MEU TIME (entre com a Globo)");
assert(has(el("bannerResumo").innerHTML, OUTRO_NOME) && has(el("bannerResumo").innerHTML, fmt(340)), "F3 (atualizado na v36) o banner mostra o CARTÃO do time buscado com o total (10 × 34 = " + fmt(340) + " pts)");

console.log("=== G · Folds: ocultas no celular, abertas na tela larga, escolha guardada ===");
reset();
api = extract();
assert(el("foldLigas").open === true && el("foldScores").open === true, "G1 na tela larga (desktop) as seções começam ABERTAS");
reset();
globalThis.matchMedia = q => ({ matches: q.includes("max-width:900px") });
api = extract();
assert(el("foldLigas").open === false && el("foldScores").open === false, "G2 no celular (≤900px) as seções começam OCULTAS — o banner carrega a informação");
reset();
store.set("sf_folds_v1", JSON.stringify({ foldLigas: false }));
api = extract();
assert(el("foldLigas").open === false, "G3 a preferência salva (foldLigas fechado) é respeitada");
assert(el("foldLigas").open === false && el("foldScores").open === true, "G4 a seção SEM preferência (foldScores) segue o padrão da tela; a com preferência continua fechada");
el("foldLigas").open = false;
el("foldLigas")._ls.toggle(); // alterna → grava a escolha
assert(JSON.parse(store.get("sf_folds_v1")).foldLigas === false, "G5 alternar uma seção GRAVA a escolha no navegador");

console.log("=== H · Temporada nova (aberto, rodada 1): limite 0 não é erro ===");
reset();
world = { rodada: 1, loggedIn: true, statusMercado: 1, obs: "Mercado Aberto", pontosPorRodada: r => 60 + r, outroPontos: () => 10 };
calls = [];
api = extract();
await waitStatus(api, "Conexão concluída");
await waitTeams(api, 1);
assert(api.limiteRodada() === 0, "H1 limite = 0 (mercado aberto para a rodada 1)");
assert(!calls.some(u => u.includes("/time/id/")), "H2 nenhuma rodada é consultada — nada disputou ainda");
assert(api.teams()[0].total === 0, "H3 total 0, sem quebrar o painel");
assert(has(api.teams()[0].status, "aguardando a 1ª rodada"), "H4 o time fica 'aguardando a 1ª rodada' (não é falha)");
assert(has(el("status").textContent, "a rodada 1 ainda não disputou"), "H5 o status explica a temporada recém-aberta");
assert(has(el("scoresLimite").textContent, "Aguardando a 1ª rodada"), "H6 o subtítulo da tabela mostra a espera");

console.log(`\nResultado: ${pass} ok, ${fail} falharam`);
process.exit(fail ? 1 : 0);
