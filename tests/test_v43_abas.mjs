// =====================================================================
// v43 — REDESIGN MOBILE COM MENU DE ABAS + ELIMINATÓRIA.
// (A) menu horizontal com ícone+texto para GERAL, CLÁSSICA, PONTOS CORRIDOS,
//     MATA-MATA e ELIMINATÓRIA; CSS sticky; a barra de busca/rodadas/dados
//     fica FORA das abas (antes do menu no HTML e nunca recebe aba-off);
// (B) no boot entra pela aba GERAL (gráficos de pontuação por rodada);
// (C) Clássica aciona a modalidade clássica do fold das ligas; (D) Pontos
//     corridos e Mata-mata idem; (E) ELIMINATÓRIA: cadastra códigos (IDs),
//     carrega pontos por rodada, classifica por pontuação, marca eliminados
//     por rodada e o campeão, desenha a evolução em SVG e grava no navegador;
// (F) remover time pelo chip; (G) mudar a regra recalcula; (H) a aba ativa
//     fica guardada; (I) navegação inferior troca de aba.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

globalThis.confirm = () => true; // v50: o painel confirma destrutivos
// ---------- stubs (classList REAL) ----------
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, innerHTML: "", textContent: "", className: "", value: "",
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { f ? this._s.add(c) : this._s.delete(c); } },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(type, fn) { (this._ls ??= {})[type] = fn; },
    focus() { this._focado = true; },
    showModal() {}, close() {}, open: false, disabled: false, select() {},
  });
  return els.get(id);
}
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document = { getElementById: el, querySelectorAll: () => [] };
globalThis.window = globalThis;
globalThis.location = { origin: "http://localhost:3000" };
try { globalThis.navigator = {}; } catch {}

const MY = 1382686, MY_NOME = "Super Fabiao PRO FC";
const rowTime = (id, nome, pos, camp, rodada = 80.5) => ({ time: { time_id: id, nome, slug: "t-" + id }, pontos: { rodada, campeonato: camp }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: pos } });
const mkLiga = (slug, nome, qtd) => ({ slug, nome, mata_mata: false, inicio_rodada: 1, fim_rodada: 38, quantidade_times: null, total_times_liga: qtd });
const mkDetalhe = (item, qtd, mePos, mePts, lider, liderPts) => {
  const times = [];
  for (let pos = 1; pos <= Math.min(qtd, 25); pos++) {
    if (pos === 1) times.push(rowTime(99001, lider, 1, liderPts));
    else if (pos === mePos) times.push({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: mePts }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: mePos } });
    else times.push(rowTime(90000 + pos, "Time Participante " + pos, pos, liderPts - pos));
  }
  const tu = mePos <= 25 ? times[mePos - 1] : { time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: mePts }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: mePos } };
  return { liga: { slug: item.slug, nome: item.nome, mata_mata: false, inicio_rodada: 1, fim_rodada: 38, quantidade_times: null, total_times_liga: qtd }, times, time_usuario: tu, pagina: 1 };
};
const LIGA1 = mkLiga("liga-normal", "LIGA NORMAL TESTE", 30);
const catalogo = { "liga-normal": mkDetalhe(LIGA1, 30, 7, 999.99, "Líder Vinte", 1200.5) };
function jsonResponse(obj, status = 200) { return { ok: status < 400, status, json: async () => obj }; }
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  const q = new URL(u, "http://x").searchParams;
  const page = Number(q.get("page")) || 1;
  if (path === "/auth/me") return jsonResponse({ loggedIn: true, kind: "local", nome: "Fabio Batista", nivel: 2 }); // v50: sessão real no portão
  if (path === "/auth/me") return jsonResponse({ loggedIn: false });
  if (path === "/auth/time") return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: 35, temporada: 2026, status_mercado: 1, status_mercado_obs: "Mercado Aberto" });
  // v43: /time/id/{id}/{rodada} — pontuação VARIA POR ID para a eliminatória classificar
  const tId = u.match(/\/time\/id\/(\d+)\/(\d+)/);
  if (tId) { const id = +tId[1], r = +tId[2];
    return jsonResponse({ pontos: 60 + r + (id % 5), time: { nome: "Time " + id, nome_time: "Time " + id, foto_trofeu: "https://s2.glbimg.com/exemplo/t" + id + ".png" } });
  }
  if (path === "/times" || path === "/busca") return jsonResponse({ times: [] });
  if (path === "/auth/ligas") return jsonResponse({ ligas: [LIGA1], total_ligas: 1 });
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

const fn = new Function(src + "\n;return { currentRound:()=>currentRound, refreshAll };");
const api = fn();
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- A · estrutura do menu de abas + barra fixa ----------
assert(has(html, 'id="menuAbas"') && has(html, 'id="abaBtnGeral"') && has(html, 'id="abaBtnClassica"') && has(html, 'id="abaBtnPontos"') && has(html, 'id="abaBtnMataMata"') && has(html, 'id="abaBtnElim"'), "A1 o menu horizontal tem as 5 abas: Geral, Clássica, Pontos corridos, Mata-mata e Eliminatória");
assert(has(html, ">📊</span><span>Geral</span>") && has(html, ">🏆</span><span>Clássica</span>") && has(html, ">🟣</span><span>Pontos corridos</span>") && has(html, ">⚔️</span><span>Mata-mata</span>") && has(html, ">🎯</span><span>Eliminatória</span>"), "A2 cada aba é um botão com ÍCONE + TEXTO");
assert(has(html, ".menu-abas{display:flex") && has(html, "position:sticky;top:0") && has(html, ".aba-off{display:none!important}"), "A3 o menu gruda no topo ao rolar e as abas trocam por classe (aba-off)");
assert(has(html, 'id="elimCodigos"') && has(html, 'id="elimBtnCadastrar"') && has(html, 'id="elimRegra"') && has(html, 'id="elimChips"') && has(html, 'id="elimTabela"') && has(html, 'id="elimGrafico"'), "A4 a aba ELIMINATÓRIA tem cadastro de códigos, regra, chips, classificação e gráfico");
const posBusca = html.indexOf('id="searchInput"'), posRodadas = html.indexOf('id="roundRange"'), posAvancado = html.indexOf('id="advBtn"'), posMenu = html.indexOf('id="menuAbas"');
assert(posMenu > 0 && posMenu < posBusca && posMenu < posRodadas && posMenu < posAvancado, "A5 o MENU SUSPENSO fica ANTES da barra de busca/rodadas/dados (v46: sempre visível no topo)");

// ---------- B · boot entra pela aba GERAL ----------
await sleep(1200);
assert(el("abaBtnGeral").classList.contains("ativo"), "B1 a aba GERAL nasce ativa");
assert(!el("foldScores").classList.contains("aba-off"), "B2 Geral mostra a pontuação por rodada");
assert(el("foldLigas").classList.contains("aba-off") && el("abaEliminatoria").classList.contains("aba-off"), "B3 Clássica/Pontos/Mata-mata/Eliminatória ficam guardadas até o clique");
assert(!el("searchInput").classList.contains("aba-off") && !el("roundRange").classList.contains("aba-off") && !el("refreshBtn").classList.contains("aba-off"), "B4 a barra de busca/rodadas/dados NÃO recebe aba-off (fica em todas as abas)");
assert(api.currentRound() === 35, "B5 o painel carrega normal (login automático da v42 intacto)");
const posFoldScores = html.indexOf('id="foldScores"');
assert(posFoldScores > 0 && html.indexOf('id="chartTodos"') > posFoldScores && has(html, 'id="chartDesempenho"') && has(html, 'id="scoresTable"') && has(html, 'id="chartLegenda"'), "B6 a aba GERAL contém a pontuação por rodada com os DOIS gráficos (individual + unificado)");

// ---------- C · Clássica aciona a modalidade ----------
el("abaBtnClassica")._ls.click({ preventDefault() {} });
assert(el("classic").classList.contains("hidden") === false && el("knockout").classList.contains("hidden") && el("points").classList.contains("hidden"), "C1 a aba CLÁSSICA abre a modalidade Ligas Clássicas (knockout/points recolhidos)");
assert(!el("foldLigas").classList.contains("aba-off") && el("foldScores").classList.contains("aba-off"), "C2 o fold das ligas entra na frente e a pontuação sai");
assert(el("abaBtnClassica").classList.contains("ativo") && !el("abaBtnGeral").classList.contains("ativo"), "C3 o menu marca a aba ativa");
assert(store.get("sf_aba_v1") === "abaClassica", "C4 a aba escolhida fica guardada no navegador");

// ---------- D · Pontos corridos e Mata-mata ----------
el("abaBtnPontos")._ls.click({ preventDefault() {} });
assert(el("points").classList.contains("hidden") === false && el("classic").classList.contains("hidden"), "D1 a aba PONTOS CORRIDOS abre a modalidade de confronto direto");
el("abaBtnMataMata")._ls.click({ preventDefault() {} });
assert(el("knockout").classList.contains("hidden") === false && el("points").classList.contains("hidden"), "D2 a aba MATA-MATA abre a modalidade de chaveamento");
assert(store.get("sf_aba_v1") === "abaMataMata", "D3 a troca continua gravada");

// ---------- E · ELIMINATÓRIA: cadastrar, classificar, eliminados, campeão, evolução ----------
el("abaBtnElim")._ls.click({ preventDefault() {} });
assert(!el("abaEliminatoria").classList.contains("aba-off") && el("foldLigas").classList.contains("aba-off"), "E1 a aba ELIMINATÓRIA entra (as ligas saem)");
el("elimCodigos").value = "101, 102\n103;104";
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
const chips = el("elimChips").innerHTML;
assert((chips.match(/elim-chip/g) || []).length === 4, "E2 os 4 códigos viraram 4 times cadastrados (IDs e nomes vindos da API): " + chips.slice(0, 120));
assert(has(el("elimTabela").innerHTML, "Time 104") && has(el("elimTabela").innerHTML, "1º") && has(el("elimTabela").innerHTML, "CAMPEÃO"), "E3 a classificação saiu ordenada por pontuação e o último sobrevivente é o CAMPEÃO");
assert(has(el("elimTabela").innerHTML, "eliminado na rodada 1") && has(el("elimTabela").innerHTML, "eliminado na rodada 2") && has(el("elimTabela").innerHTML, "eliminado na rodada 3"), "E4 a regra (1 eliminado por rodada) marcou quem saiu e EM QUE RODADA");
assert(has(el("elimTabela").innerHTML, "Time 104") && String(el("elimTabela").innerHTML).indexOf("Time 104") < String(el("elimTabela").innerHTML).indexOf("Time 101"), "E5 ordem de pontuação: o 104 (maior total) vem antes do 101");
assert(has(el("elimGrafico").innerHTML, "<svg") && has(el("elimGrafico").innerHTML, "<polyline") && (el("elimGrafico").innerHTML.match(/polyline/g) || []).length === 4, "E6 a EVOLUÇÃO por rodada desenha as 4 linhas em SVG");
const salvo = store.get("sf_eliminatoria_v2") || "";
assert(has(salvo, '"liga"') && has(salvo, "101") && has(salvo, "104"), "E7 a eliminatória fica REGISTRADA no navegador (v44: liga + ids + regra + rodadas + premiação)");
assert(has(el("elimPrincipal").innerHTML, "3 eliminado(s)") && has(el("elimPrincipal").innerHTML, "Último eliminado"), "E8 a visão PRINCIPAL resume os eliminados e marca o ÚLTIMO eliminado");

// ---------- F · remover time pelo chip ----------
await el("elimChips")._ls.click({ target: { getAttribute: () => "103" } });
assert((el("elimChips").innerHTML.match(/elim-chip/g) || []).length === 3 && !has(store.get("sf_eliminatoria_v1"), "103"), "F1 o ✕ do chip REMOVE o time e regrava o registro");

// ---------- G · mudar a regra recalcula ----------
el("elimCodigos").value = "103"; // repõe o time removido no F para a regra 2 ter 2 rodadas
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
el("elimRegra").value = "2";
await el("elimRegra")._ls.change();
await sleep(30);
assert(has(el("elimTabela").innerHTML, "eliminado na rodada 1") && has(el("elimTabela").innerHTML, "eliminado na rodada 2") && has(el("elimTabela").innerHTML, "CAMPEÃO"), "G1 regra 2/rodada: dois saem na rodada 1, um na rodada 2 e sobra o campeão");
assert(has(store.get("sf_eliminatoria_v2"), '"regra":2'), "G2 a regra escolhida fica gravada junto");

// ---------- H · voltar ao Geral mantém a barra ----------
el("abaBtnGeral")._ls.click({ preventDefault() {} });
assert(!el("foldScores").classList.contains("aba-off") && el("abaEliminatoria").classList.contains("aba-off") && !el("searchInput").classList.contains("aba-off"), "H1 de volta ao Geral: gráficos na frente, barra de busca/rodadas sempre visível, eliminatória guardada");

// ---------- I · navegação inferior troca de aba ----------
assert(has(html, 'data-goto="foldScores"') && has(html, 'mostrarAba(alvo==="foldLigas"?"abaClassica":"abaGeral",false)'), "I1 os atalhos inferiores (v33) continuam lá e agora TROCAM DE ABA (Ligas → Clássica; demais → Geral)");

console.log(`\n=== v43 (menu de abas + eliminatória): ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
