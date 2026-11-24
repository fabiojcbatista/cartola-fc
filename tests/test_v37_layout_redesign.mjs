// =====================================================================
// v37 — REDESIGN DE LEGIBILIDADE: (A) cabeçalhos unificados (sem barra
// duplicada na lista de times, sem cabeçalho repetido na pontuação);
// (B) ligas clássicas em CARDS respiráveis com 👑 Líder + Dif. p/ líder
// mantidos, posição “Xº de N” e NÚMEROS com separador de milhar;
// (C) lista de times em cards com ponto de status e clique que seleciona
// o time no gráfico; (D) ícones SVG na navegação inferior. Harness de
// stubs, nada toca a rede.
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
    id, innerHTML: "", textContent: "", className: "", value: "",
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(type, fn){ (this._ls ??= {})[type] = fn; },
    showModal(){}, close(){}, open: false, disabled: false, select(){},
  });
  return els.get(id);
}
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document = { getElementById: el, querySelectorAll: () => [] };
globalThis.window = globalThis;
globalThis.location = { origin: "http://localhost:3000" };
try { globalThis.navigator = {}; } catch {}

const MY = 1382686, MY_NOME = "Super Fabiao PRO FC";
const OUTRO = 777, OUTRO_NOME = "Outro Time FC", OUTRO_ESCUDO = "https://s2.glbimg.com/exemplo/outro.png";
const rowTime = (id, nome, pos, camp, rodada = 80.5) => ({ time: { time_id: id, nome, slug: "t-" + id }, pontos: { rodada, campeonato: camp }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: pos } });
const mkLiga = (slug, nome, qtd) => ({ slug, nome, mata_mata: false, inicio_rodada: 1, fim_rodada: 38, quantidade_times: null, total_times_liga: qtd });
const mkDetalhe = (item, qtd, mePos, mePts, lider, liderPts) => {
  const times = [];
  for (let pos = 1; pos <= Math.min(qtd, 25); pos++) {
    if (pos === 1) times.push(rowTime(99001, lider, 1, liderPts));
    else if (pos === mePos) times.push({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: mePts }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: mePos } });
    else times.push(rowTime(90000 + pos, "Time Participante " + pos, pos, liderPts - pos));
  }
  const tu = mePos <= 25 ? times[mePos - 1] : { time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: mePts }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: mePos } }; // v37: na liga gigante a API embute a linha do meu time (ranking) — como na resposta real
  return { liga: { slug: item.slug, nome: item.nome, mata_mata: false, inicio_rodada: 1, fim_rodada: 38, quantidade_times: null, total_times_liga: qtd }, times, time_usuario: tu, pagina: 1 };
};
const LIGA1 = mkLiga("liga-normal", "LIGA NORMAL TESTE", 30);
const LIGA2 = mkLiga("liga-gigante", "LIGA GIGANTE TESTE", 1991563);
let catalogo = {
  "liga-normal": mkDetalhe(LIGA1, 30, 7, 999.99, "Líder Vinte", 1200.5),
  "liga-gigante": mkDetalhe(LIGA2, 1991563, 54608, 2943.35, "Rei da Gigante", 2953.35),
};
function jsonResponse(obj) { return { ok: true, status: 200, json: async () => obj }; }
globalThis.fetch = async (url) => {
  const u = String(url);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  const q = new URL(u, "http://x").searchParams;
  const page = Number(q.get("page")) || 1;
  if (path === "/auth/me") return jsonResponse({ loggedIn: true });
  if (path === "/auth/time") return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: 35, temporada: 2026, status_mercado: 1, status_mercado_obs: "Mercado Aberto" });
  if (path.startsWith("/time/id/")) {
    const p = path.split("/"); const id = Number(p[3]), r = Number(p[4]);
    if (id === MY) return jsonResponse({ time: { nome: MY_NOME, foto_trofeu: "https://s2.glbimg.com/exemplo/meu.png" }, pontos: { rodada: 60 + r } });
    return jsonResponse({ time: { nome: OUTRO_NOME, foto_trofeu: OUTRO_ESCUDO }, pontos: { rodada: 100 - r } });
  }
  if (path === "/times" || path === "/busca") {
    const termo = decodeURIComponent((u.split("?")[1] || "").replace(/^q=/, ""));
    if (termo.toLowerCase().includes("outro")) return jsonResponse({ times: [{ time_id: OUTRO, nome: OUTRO_NOME, slug: "outro-time-fc" }] });
    return jsonResponse({ times: [] });
  }
  if (path === "/auth/ligas") return jsonResponse({ ligas: [LIGA1, LIGA2], total_ligas: 2 });
  if (path.startsWith("/auth/liga/")) {
    const slug = decodeURIComponent(path.split("/").pop());
    const d = catalogo[slug];
    if (!d) return { ok: false, status: 404, json: async () => ({}) };
    const rows = d.times.slice((page - 1) * 20, page * 20);
    return jsonResponse({ liga: d.liga, times: rows, time_usuario: d.time_usuario, pagina: page });
  }
  if (path === "/auth/ligas2" || path === "/auth/competicoes/pontoscorridos") return jsonResponse([]);
  return { ok: false, status: 404, json: async () => ({}) };
};

try{globalThis.__SF_ACESSO_PRESET={nivel:2,nome:"Fabio Batista"}}catch{} // v41: injeção de acesso para os testes (em uso real, toda carga pede login)
const fn = new Function(src + "\n;return { teams:()=>teams, refreshAll, render, addSearchTeam, buildScoresTable, roundColumns, currentRound:()=>currentRound };");
const api = fn();
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function esperar(cond, descricao) {
  for (let i = 0; i < 600; i++) { await sleep(25); if (cond()) return; }
  throw new Error("condição não atingiu: " + descricao);
}
const classic = () => el("classicTable").innerHTML;
const clCard = (nome) => {
  const t = classic(); const i = t.indexOf(nome);
  if (i < 0) throw new Error("card não encontrado: " + nome);
  const start = t.lastIndexOf('class="liga-card', i);
  const j = t.indexOf('class="liga-card', i + nome.length);
  return t.slice(start, j < 0 ? t.length : j);
};

// ---------- A · cabeçalhos unificados ----------
assert(!has(html, ">Lista de times monitorados<") && !has(html, 'class="panel-title"'), "A1 a barra duplicada “Lista de times monitorados” saiu (o summary do fold é o único título)");
assert(!has(html, 'id="scoresLimite"') && !has(html, ">Pontuação por rodada <small>"), "A2 o cabeçalho repetido da pontuação saiu (summary + gráfico bastam)");
assert(has(html, "Ligas Clássicas <small>(suas ligas no Cartola)</small>") && has(html, "Classificação oficial"), "A3 o cabeçalho fino das ligas permanece (com o link da classificação oficial)");
assert(has(html, 'id="foldLigas"') && has(html, 'id="foldScores"'), "A4 os folds de ligas e pontuação continuam com seus summaries");

// ---------- B · formatInt / ordinal ----------
assert(has(src, 'function formatInt(n)') && has(src, 'function ordinal(n){return n===null?"—":formatInt(n)+"º"}'), "B1 formatInt existe e o ordinal agora usa separador de milhar");

// ---------- C · login carrega tudo; ligas clássicas em cards ----------
await esperar(() => api.currentRound() === 35, "refreshAll concluir");
await esperar(() => classic().includes("liga-card"), "cards das clássicas renderizarem");
await esperar(() => Object.keys(api.teams()[0].scores || {}).length >= 30, "histórico do Meu time carregar");
api.render();
const card1 = clCard("LIGA NORMAL TESTE");
assert(has(classic(), 'class="liga-card') && !has(classic(), "<thead>") && !has(classic(), "me-row"), "C1 clássicas renderizam CARDS (sem tabela, sem linha dourada repetida)");
assert(has(card1, "7º") && has(card1, "de 30"), "C2 posição “7º de 30” no card");
assert(has(card1, "999,99") && has(card1, ">Pontos</span>"), "C3 pontos do campeonato no formato pt-BR");
assert(has(card1, "👑 Líder: Líder Vinte (1.200,50 pts)") && has(card1, "Dif. p/ líder: −200,51"), "C4 👑 Líder + Dif. p/ líder MANTIDOS no card");
assert(has(card1, 'class="liga-card sua"'), "C5 a liga do MEU TIME ganha o destaque azul (classe sua)");
assert(has(card1, "LIGA NORMAL TESTE") && has(card1, "/liga/liga-normal"), "C6 nome com link para a liga oficial");
const card2 = clCard("LIGA GIGANTE TESTE");
assert(has(card2, "1.991.563") && has(card2, "54.608º") && has(card2, "de 1.991.563"), "C7 NÚMEROS GRANDES com separador de milhar (1.991.563 e 54.608º)");
assert(has(card2, 'class="liga-card sua"'), "C8 liga gigante também é do meu time → destaque");
assert(has(classic(), "Time Participante") === false, "C9 o card NÃO desenha a classificação completa (só o que importa)");

// ---------- D · lista de times em cards com status e clique ----------
api.render();
const lista = el("bannerResumo").innerHTML;
assert(has(lista, 'class="me-card"') && has(lista, "MEU TIME") && has(lista, "pts"), "D1 o banner mostra o cartão do Meu time (total e situação)");
assert(has(lista, OUTRO_NOME) === false, "D2 (pré-busca) só o Meu time na lista");
el("searchInput").value = "Outro Time FC";
await api.addSearchTeam();
await esperar(() => api.teams().length === 2 && Object.keys(api.teams()[1].scores || {}).length >= 30, "outro time carregado");
api.render();
const lista2 = el("bannerResumo").innerHTML;
assert(has(lista2, 'data-time-card="777"') && has(lista2, OUTRO_ESCUDO), "D3 card do time buscado no banner: clicável (data-time-card) e com escudo");
assert(has(lista2, "MEU TIME"), "D4 o cartão do Meu time mantido no banner");
assert(typeof el("bannerResumo")._ls?.click === "function", "D5 o listener de clique do banner está registrado");
el("bannerResumo")._ls.click({ target: { closest: (s) => s === ".me-card.outro[data-time-card]" ? { dataset: { timeCard: String(OUTRO) } } : null } });
assert(has(el("chartSub").textContent, OUTRO_NOME), "D6 CLIQUE no card da lista → o gráfico passa a mostrar o time buscado");
assert(has(el("bannerResumo").innerHTML, "me-card outro sel"), "D7 o cartão do time escolhido ganha o contorno azul");

// ---------- E · ícones SVG na navegação inferior ----------
const svgCount = (html.match(/<svg viewBox="0 0 24 24" width="21" height="21"/g) || []).length;
assert(svgCount === 4, "E1 os 4 botões da navegação inferior usam ícones SVG vetoriais");
assert(!has(html, 'class="bn-ico">🏠') && !has(html, 'class="bn-ico">👥') && !has(html, 'class="bn-ico">🏆') && !has(html, 'class="bn-ico">📊'), "E2 nenhum emoji nativo na navegação inferior");

// ---------- F · mata-mata e pontos corridos seguem tabelas (não eram o alvo) ----------
assert(has(src, '"<thead><tr><th>#</th><th>Liga</th><th>Times</th><th>Rodadas</th>'), "F1 mata-mata mantém a tabela (não era o alvo do feedback)");
assert(has(src, '"<thead><tr><th>#</th><th>Liga</th><th>Times</th><th>Rodadas</th><th>Situação</th><th>Posição</th><th>Pontos</th><th>V</th>'), "F2 pontos corridos mantém a tabela (com ordinal formatado)");
assert(has(src, 'function positionClass(pos)'), "F3 classes de posição (ouro/prata/bronze) seguem para mata-mata e PC");

console.log(`\n=== v37: ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
