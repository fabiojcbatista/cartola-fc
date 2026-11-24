// =====================================================================
// v46 — SÉRIE DE AJUSTES:
// (A) a seção "Times cadastrados" saiu da aba Geral (os cards dos times ficam no
//     banner-resumo do cabeçalho, clicáveis) e nada quebra no boot;
// (B) os subtítulos dos gráficos ganham o preenchimento navy dos títulos de seção;
// (C) o footnote de rodadas abaixo da tabela de pontuação saiu;
// (D) o menu de abas fica SUSPENSO: fora do <main> (grid area prendia o sticky),
//     colado no topo em todas as telas + scroll-margin para as seções;
// (E) os 3 botões intermediários do fold das ligas saíram (o menu escolhe a modalidade);
// (F) eliminatória e mensal: card de MONTAGEM + PÓDIO de classificados com os valores
//     GANHOS (encerrada) ou A GANHAR (em andamento) e pills 4º+.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

globalThis.confirm = () => true; // v50: o painel confirma destrutivos
// ---------- stubs (padrão da bateria) ----------
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
    focus() {}, showModal() {}, close() {}, open: false, disabled: false, select() {},
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
const LIGA1 = { slug: "liga-normal", nome: "LIGA NORMAL TESTE", mata_mata: false, inicio_rodada: 1, fim_rodada: 38, quantidade_times: null, total_times_liga: 30 };
const rowTime = (id, nome, pos, camp, rodada = 80.5) => ({ time: { time_id: id, nome, slug: "t-" + id }, pontos: { rodada, campeonato: camp }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: pos } });
const detalhe = { liga: LIGA1, times: [rowTime(99001, "Líder Vinte", 1, 1200.5), { time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: 999.99 }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: 7 } }], time_usuario: { time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" }, pontos: { rodada: 70.5, campeonato: 999.99 }, ranking: { rodada: 1, turno: 2, mes: 4, campeonato: 7 } }, pagina: 1 };
function jsonResponse(obj, status = 200) { return { ok: status < 400, status, json: async () => obj }; }
globalThis.fetch = async (url) => {
  const u = String(url);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  const page = Number(new URL(u, "http://x").searchParams.get("page")) || 1;
  if (path === "/auth/me") return jsonResponse({ loggedIn: true, kind: "local", nome: "Fabio Batista", nivel: 2 }); // v50: sessão real no portão
  if (path === "/auth/me") return jsonResponse({ loggedIn: false });
  if (path === "/auth/time") return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: 35, temporada: 2026, status_mercado: 1, status_mercado_obs: "Mercado Aberto" });
  const tId = u.match(/\/time\/id\/(\d+)\/(\d+)/);
  if (tId) { const id = +tId[1], r = +tId[2];
    const pts = 60 + r + (id % 5);
    return jsonResponse({ pontos: pts, time: { nome: "Time " + id, nome_time: "Time " + id, foto_trofeu: "https://s2.glbimg.com/exemplo/t" + id + ".png" } });
  }
  if (path === "/times" || path === "/busca") return jsonResponse({ times: [] });
  if (path === "/auth/ligas") return jsonResponse({ ligas: [LIGA1], total_ligas: 1 });
  if (path.startsWith("/auth/liga/")) return jsonResponse({ ...detalhe, times: detalhe.times.slice((page - 1) * 20, page * 20), pagina: page });
  if (path === "/auth/ligas2" || path === "/auth/competicoes/pontoscorridos") return jsonResponse([]);
  return { ok: false, status: 404, json: async () => ({}) };
};

const fn = new Function(src + "\n;return { currentRound:()=>currentRound };");
const api = fn(); // executa o script inteiro (boot) — os listeners passam a existir
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- A · Times cadastrados saiu; os cards dos times ficam no banner ----------
assert(!has(html, 'id="foldTimes"') && !has(html, 'id="teamList"') && !has(html, "Times cadastrados<span"), "A1 a seção Times cadastrados saiu da aba Geral (fold + lista)");
assert(has(html, 'id="bannerResumo"') && has(src, "bannerResumo\").addEventListener"), "A2 os cards dos times ficam no banner-resumo do cabeçalho (com clique pro gráfico)");
assert(has(src, 'const tl=$("teamList");if(!tl)return;'), "A3 renderTeams guarda a lista removida — o boot não quebra");
await sleep(1200);
assert(typeof el("mensBtnCadastrar")._ls?.click === "function" && typeof el("abaBtnMensal")._ls?.click === "function" && typeof el("refreshBtn")._ls?.click === "function", "A4 o painel carrega inteiro sem a seção (todos os listeners do boot registrados)");

// ---------- B · subtítulos dos gráficos com preenchimento navy ----------
assert(has(html, ".chart-head,.chart-todos-head{margin:0 0 8px;padding:11px 14px;border-radius:14px;background:linear-gradient(115deg,var(--navy-card),var(--navy))"), "B1 os subtítulos dos gráficos (Desempenho por rodada / Todos os times) ganham o preenchimento navy");
assert(has(html, ".chart-head b,.chart-todos-head b{color:#fff}") && has(html, ".chart-head .chart-ico,.chart-todos-head .chart-ico{background:rgba(255,255,255,.14)"), "B2 texto branco e ícone translúcido como nos títulos de seção");

// ---------- C · footnote de rodadas saiu ----------
assert(!has(html, "o parcial da rodada corrente entra na soma") && !has(html, "continua somando TODAS as rodadas já disputadas"), "C1 o texto final de rodadas abaixo da tabela de pontuação foi removido");

// ---------- D · menu de abas suspenso em todas as telas ----------
const bodyHtml = html.slice(html.indexOf("</header>"));
assert(bodyHtml.indexOf('<nav class="menu-abas"') >= 0 && bodyHtml.indexOf('<nav class="menu-abas"') < bodyHtml.indexOf("<main>"), "D1 o menu de abas fica FORA do main (irmão dele, logo após o cabeçalho)");
assert(has(html, ".menu-abas{display:flex;gap:6px;overflow-x:auto;position:sticky;top:0;z-index:60"), "D2 o menu mantém position:sticky;top:0 — agora desliza de verdade (fora da grid)");
assert(has(html, "scroll-margin-top:116px"), "D3 as seções têm scroll-margin-top (menu suspenso + minibar — v47);");
assert(has(html, 'data-goto="bannerResumo"') && !has(html, 'data-goto="foldTimes"'), "D4 o atalho inferior TIMES leva aos cards dos times no cabeçalho");

// ---------- E · os 3 botões intermediários do fold das ligas saíram ----------
assert(!has(html, 'data-target="classic"') && !has(html, 'data-target="knockout"') && !has(html, 'data-target="points"'), "E1 os 3 botões intermediários (Clássicas/Mata-Mata/Pontos Corridos) saíram");
assert(has(html, 'id="classic"') && has(html, 'id="knockout"') && has(html, 'id="points"'), "E2 as três modalidades continuam no fold (controladas pelo menu de abas)");

// ---------- F · card de montagem + PÓDIO ----------
assert((html.match(/class="elim-monta-tit"/g) || []).length === 2 && (html.match(/class="elim-monta"/g) || []).length === 2, "F1 eliminatória e mensal ganham o card de MONTAGEM da competição");
assert(!has(html, '<label for="elimCodigos" style=') && !has(html, '<label for="mensCodigos" style='), "F2 os labels inline viraram estilo do card (padronizados)");
assert(has(src, "function sfPodioHTML(premiados,finalizada)") && has(html, ".podio-col.ouro") && has(html, ".podio-col.prata") && has(html, ".podio-col.bronze"), "F3 o componente PÓDIO existe (degraus ouro/prata/bronze)");
assert(has(src, 'finalizada?"Ganho: ":"A ganhar: "') && has(html, ".podio-chip"), "F4 o pódio mostra o valor GANHO (encerrada) ou A GANHAR (em andamento) + pills 4º+");
assert(has(src, "podioBloco") && !has(src, "campeoesBloco") && !has(src, "faixaHoje"), "F5 o pódio substituiu os blocos antigos CAMPEÃO/faixa nas duas competições");

// runtime: eliminatória 30–34 → finalizada → pódio com os valores ganhos
el("abaBtnElim")._ls.click({ preventDefault() {} });
el("elimCodigos").value = "SUPERLIGA TESTE=>101;102;103;104";
el("elimRodInicio").value = "30";
el("elimRodFim").value = "34";
el("elimRodFim")._ls.change();
el("elimPremios").value = "1 - 1000; 2-500;3-250";
el("elimPremios")._ls.change();
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
const prinE = el("elimPrincipal").innerHTML;
assert(has(prinE, "podio-tit") && has(prinE, "Resultado final") && has(prinE, "Time 104") && has(prinE, "podio-col ouro") && has(prinE, "Ganho: R$ 1.000"), "F6 encerrada a competição, o PÓDIO mostra o CAMPEÃO e o valor GANHO");
assert(has(prinE, "podio-col prata") && has(prinE, "Ganho: R$ 500") && has(prinE, "podio-col bronze") && has(prinE, "Ganho: R$ 250"), "F7 os degraus de prata e bronze mostram 2º/3º com os valores");

console.log(`\n=== v46 (ajustes): ${pass} ok, ${fail} falharam ===`);
if (fail) process.exit(1);
