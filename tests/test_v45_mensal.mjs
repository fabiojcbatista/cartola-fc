// =====================================================================
// v45 — ABA MENSAL: menu novo semelhante à Eliminatória, mas SEM eliminação.
// (A) aba nova no nav + importação no formato NOME DA LIGA=>T1;T2;T3 com estado
//     PRÓPRIO (sf_mensal_v1); (B) classificação pela SOMA dos pontos das rodadas
//     (em andamento: projeção "se terminasse hoje" + quem teria os prêmios);
// (C) exibição por rodada: pontos DA rodada, premiados da rodada e NINGUÉM
//     eliminado; (D) FINALIZADA: campeão = 1º da soma com as premiações;
// (E) persistência e limpar.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

globalThis.confirm = () => true; // v50: o painel confirma destrutivos
// ---------- stubs (iguais aos da bateria da eliminatória) ----------
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
const api = fn();
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- A · aba nova no nav + importação com estado próprio ----------
assert(has(html, 'id="abaBtnMensal"') && has(html, ">Mensal</span>"), "A1 existe o botão MENSAL no menu de abas");
assert(has(html, 'id="abaMensal"') && has(html, 'id="mensTabela"') && has(html, 'id="mensRodadasStrip"') && has(html, 'id="mensGrafico"'), "A2 a aba Mensal existe com cartão, classificação, rodadas e gráfico");
assert(!has(html, "Eliminar por rodada <select id=\"mensRegra\"") && !has(html, 'id="mensRegra"'), "A3 a mensal NÃO tem regra de eliminação (ninguém sai)");
await sleep(1200);
el("abaBtnMensal")._ls.click({ preventDefault() {} });
await sleep(30);
assert(!el("abaMensal").classList.contains("aba-off") && el("abaGeral").classList.contains("aba-off"), "A4 o clique abre a aba Mensal");
el("mensCodigos").value = "MENSAL TESTE=>101;102;103;104";
await el("mensBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
assert(has(el("mensMsg").textContent, 'Liga "MENSAL TESTE"') && (el("mensChips").innerHTML.match(/elim-chip/g) || []).length === 4, "A5 o formato NOME DA LIGA=>T1;T2;T3;T4 importa a liga nomeada com os 4 times");
assert(has(store.get("sf_mensal_v1") || "", '"liga":"MENSAL TESTE"') && has(store.get("sf_mensal_v1"), "101"), "A6 liga e times ficam registrados no estado PRÓPRIO da mensal (sf_mensal_v1)");
assert(has(el("mensHeadLiga").textContent, "MENSAL TESTE") && has(el("mensTituloClassificacao").innerHTML, "MENSAL TESTE"), "A7 o NOME DA LIGA aparece no cabeçalho e na classificação da mensal");
el("mensPremios").value = "1 - 1000; 2-500;3-250";
await el("mensPremios")._ls.change();
await sleep(30);

// ---------- B · classificação pela SOMA (em andamento: rodadas 1–38, dados até 34) ----------
el("mensRodInicio").value = "1";
await el("mensRodInicio")._ls.change();
el("mensRodFim").value = "38";
await el("mensRodFim")._ls.change();
await sleep(30);
const tabM = el("mensTabela").innerHTML;
// soma das rodadas 1–34: 104: 2771 · 103: 2737 · 102: 2703 · 101: 2669
const prinB = el("mensPrincipal").innerHTML;
assert(has(prinB, "Rodada 35 em andamento") && has(prinB, "NINGUÉM é eliminado"), "B1 status em andamento e o resumo diz que NINGUÉM é eliminado");
assert(has(tabM, "2.771") && has(tabM, "2.737") && has(tabM, "2.703") && has(tabM, "2.669"), "B2 a classificação mostra a SOMA dos pontos das rodadas 1–34 (2771/2737/2703/2669)");
assert(String(tabM).indexOf("Time 104") < String(tabM).indexOf("Time 103") && String(tabM).indexOf("Time 103") < String(tabM).indexOf("Time 102"), "B3 a ordem é por quem SOMOU mais (104 → 103 → 102 → 101)");
const prinM = el("mensPrincipal").innerHTML;
assert(has(prinM, "podio-tit") && has(prinM, "Se terminasse hoje") && has(prinM, "Se terminasse hoje") && has(prinM, "Time 104") && has(prinM, "A ganhar: R$ 1.000") && has(prinM, "A ganhar: R$ 500") && has(prinM, "podio-col ouro"), "B4 o PÓDIO mostra quem SERIA campeão pela soma e os valores A GANHAR");
assert(has(tabM, "posição de CAMPEÃO") && has(tabM, "se terminar hoje: R$ 1.000") && has(tabM, "se terminar hoje: R$ 500"), "B5 na classificação, quem TERIA os prêmios aparece marcado pela soma atual");

// ---------- C · exibição por rodada: pontos DA rodada e NINGUÉM eliminado ----------
const stripM = el("mensRodadasStrip").innerHTML;
assert(has(stripM, 'data-mr="31"') && (stripM.match(/er-btn/g) || []).length >= 38, "C1 a faixa de rodadas da mensal cobre as rodadas da competição (R1…R38)");
const btn31 = [...stripM.matchAll(/data-mr="31"/g)].length;
assert(btn31 === 1, "C1b a rodada 31 tem aba própria");
el("mensRodadasStrip").innerHTML = stripM; // no stub o clique usa o elemento alvo via getAttribute
const ev31 = { target: { getAttribute: () => "31" } };
el("mensRodadasStrip")._ls.click(ev31);
await sleep(30);
const rodM = el("mensRodadaPainel").innerHTML;
assert(has(rodM, "Rodada 31") && has(rodM, "Pontos na rodada"), "C2 o painel da rodada 31 abre com os pontos da rodada");
assert(String(rodM).indexOf("Time 104") < String(rodM).indexOf("Time 103") && has(rodM, "95") && has(rodM, "92"), "C3 a rodada é classificada pelos PONTOS DA RODADA (104: 95, 103: 94, 102: 93, 101: 92)");
assert(has(rodM, "Faixa de premiação nesta rodada") && has(rodM, "R$ 1.000") && has(rodM, "R$ 500"), "C4 os premiados DA rodada aparecem (1º → R$ 1.000, 2º → R$ 500)");
assert(has(rodM, "NINGUÉM é eliminado") && !has(rodM, "elim-badge elim"), "C5 NINGUÉM é eliminado na mensal (nenhum badge de eliminação)");
assert(has(rodM, "2.480"), "C6 o acumulado até a rodada também aparece (104 somou 2.480 nas rodadas 1–31)");

// ---------- D · FINALIZADA: campeão = 1º da soma, com as premiações ----------
el("mensRodFim").value = "34";
await el("mensRodFim")._ls.change();
await sleep(30);
const prinD = el("mensPrincipal").innerHTML;
assert(has(prinD, "competição FINALIZADA") && has(prinD, "Resultado final") && has(prinD, "Time 104") && has(prinD, "Ganho: R$ 1.000"), "D1 encerradas todas as rodadas (1–34), o CAMPEÃO é o 1º da SOMA (Time 104)");
assert(has(prinD, "podio-col prata") && has(prinD, "podio-col bronze") && has(prinD, "Ganho: R$ 500") && has(prinD, "Ganho: R$ 250"), "D2 os degraus de prata e bronze do PÓDIO mostram os valores ganhos");
const tabD = el("mensTabela").innerHTML;
assert(has(tabD, "🏆 CAMPEÃO") && has(tabD, "2º lugar") && has(tabD, "3º lugar"), "D3 a classificação final mostra posições e prêmios (104 campeão; 103 2º; 102 3º)");

// ---------- E · persistência e limpar ----------
const gravado = store.get("sf_mensal_v1") || "";
assert(has(gravado, '"rodInicio":1') && has(gravado, '"rodFim":34') && has(gravado, '"premios":[[1,1000],[2,500],[3,250]]'), "E1 rodadas e premiações (digitadas com ;) ficam gravadas na mensal");
el("mensBtnLimpar")._ls.click({ preventDefault() {} });
await sleep(30);
assert(has(el("mensChips").innerHTML, "Nenhum time cadastrado") && has(el("mensTabela").innerHTML, "depois de importar os times"), "F1 limpar esvazia a mensal e a classificação volta ao estado inicial");
const gravado2 = store.get("sf_mensal_v1") || "";
assert(!has(gravado2, "101") || has(gravado2, '"ids":[]'), "F2 o estado limpo é regravado (sem times)");

// ---------- G · a eliminatória continua intocada ao lado ----------
el("abaBtnElim")._ls.click({ preventDefault() {} });
await sleep(30);
assert(!el("abaEliminatoria").classList.contains("aba-off") && el("abaMensal").classList.contains("aba-off"), "G1 voltar para a aba Eliminatória funciona e a Mensal fica oculta");

console.log(`\n=== v45 (aba mensal): ${pass} ok, ${fail} falharam ===`);
if (fail) process.exit(1);
