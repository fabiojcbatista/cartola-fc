// =====================================================================
// v44 — ELIMINATÓRIA EM COMPETIÇÃO.
// (A) importação no formato NOME DA LIGA=>TIME1;TIME2;TIME3 (com nome da liga
//     gravado); (B) RODADA INICIAL/FINAL: classificação e eliminação usam a
//     pontuação ACUMULADA da competição (rodadas 30–34 aqui); (C) FAIXA DE
//     PREMIAÇÃO POSIÇÃO-VALOR,POSIÇÃO-VALOR com R$ na classificação e posições
//     finais pela ordem de eliminação; (D) VISÃO PRINCIPAL: nome da liga,
//     status FINALIZADA, CAMPEÃO com prêmio, ÚLTIMO ELIMINADO e faixa atual;
// (E) status "Rodada X em andamento" quando a competição ainda não acabou;
// (F) EXIBIÇÃO POR ABA DE RODADA: tiras R{início}…R{fim}, premiados da rodada
//     e eliminados da rodada; (G) EXPORTAR no mesmo formato da importação;
// (H) persistência completa (liga, rodadas, premiação, regra); (I) limpar.
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
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  const page = Number(new URL(u, "http://x").searchParams.get("page")) || 1;
  if (path === "/auth/me") return jsonResponse({ loggedIn: true, kind: "local", nome: "Fabio Batista", nivel: 2 }); // v50: sessão real no portão
  if (path === "/auth/me") return jsonResponse({ loggedIn: false });
  if (path === "/auth/time") return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: 35, temporada: 2026, status_mercado: 1, status_mercado_obs: "Mercado Aberto" });
  // v44: /time/id/{id}/{rodada} — pontuação VARIA POR ID para a eliminatória classificar
  const tId = u.match(/\/time\/id\/(\d+)\/(\d+)/);
  if (tId) { const id = +tId[1], r = +tId[2];
    // v44.1: 555 é forte até a rodada 31 e desaba em 32–33; 556 é o oposto — para provar
    // que a eliminação segue a MENOR PONTUAÇÃO DA RODADA (e não o acumulado da competição)
    const espec = { 555: { 30: 200, 31: 200, 32: 20, 33: 20 }, 556: { 30: 150, 31: 150, 32: 63, 33: 64 } };
    const pts = (espec[id] && espec[id][r] !== undefined) ? espec[id][r] : 60 + r + (id % 5);
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

// ---------- A · importação no formato NOME DA LIGA=>TIME1;TIME2;TIME3 ----------
await sleep(1200);
el("abaBtnElim")._ls.click({ preventDefault() {} });
el("elimCodigos").value = "SUPERLIGA TESTE=>101;102;103;104";
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
assert(has(el("elimMsg").textContent, 'Liga "SUPERLIGA TESTE"') && (el("elimChips").innerHTML.match(/elim-chip/g) || []).length === 4, "A1 o formato NOME DA LIGA=>T1;T2;T3;T4 cadastra a liga nomeada com os 4 times");
assert(has(store.get("sf_eliminatoria_v2") || "", '"liga":"SUPERLIGA TESTE"') && has(store.get("sf_eliminatoria_v2"), "101"), "A2 o nome da liga e os times ficam registrados (sf_eliminatoria_v2)");
assert(has(html, ">Importar times</button>") && !has(html, ">Cadastrar times</button>"), "A5 o botão de cadastro agora se chama IMPORTAR TIMES");
assert(has(el("elimHeadLiga").textContent, "SUPERLIGA TESTE") && has(el("elimTituloClassificacao").innerHTML, "SUPERLIGA TESTE") && has(el("elimTituloRodadas").innerHTML, "SUPERLIGA TESTE"), "A4 o NOME DA LIGA aparece no cabeçalho da aba, na classificação e na exibição por rodada");
el("elimCodigos").value = "LIGA A=>201;202\nLIGA B=>203;204";
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(100);
assert(has(el("elimMsg").textContent, "UMA linha por vez"), "A3 várias eliminatórias de uma vez recebem orientação clara (uma por vez)");

// ---------- B · rodada inicial/final: competição nas rodadas 30–34 ----------
el("elimRodInicio").value = "30";
el("elimRodFim").value = "34";
await el("elimRodFim")._ls.change();
await sleep(30);
const tab = el("elimTabela").innerHTML;
assert(has(tab, "98") && has(tab, "97") && has(tab, "96") && has(tab, "95") && !has(tab, "480"), "B1 a classificação mostra os PONTOS DA RODADA 34 (98/97/96/95), NÃO o total (480 não aparece)");
assert(has(tab, "eliminado na rodada 30") && has(tab, "eliminado na rodada 31") && has(tab, "eliminado na rodada 32") && has(tab, "CAMPEÃO"), "B2 a eliminação começa na rodada INICIAL e segue rodada a rodada (101→30, 102→31, 103→32, campeão 104)");
assert(String(tab).indexOf("Time 104") < String(tab).indexOf("Time 103") && String(tab).indexOf("Time 103") < String(tab).indexOf("Time 101"), "B3 a classificação fica em ordem de pontuação");

// ---------- C · faixa de premiação POSIÇÃO-VALOR,POSIÇÃO-VALOR ----------
el("elimPremios").value = "1 - 1000, 2 - 500"; // com espaços: o formato POS - VALOR tem de ser aceito
await el("elimPremios")._ls.change();
await sleep(30);
const tabP = el("elimTabela").innerHTML;
assert(has(tabP, "R$ 1.000") && has(tabP, "R$ 500"), "C1 os prêmios aparecem na classificação (1º → R$ 1.000, 2º → R$ 500)");
assert(String(tabP).indexOf("CAMPEÃO") < String(tabP).indexOf("R$ 500") && has(tabP, "2º lugar"), "C2 a posição FINAL segue a ordem de eliminação (campeão 1º; o último eliminado é 2º)");
assert(has(el("elimPremiosResumo").innerHTML, "1º → R$ 1.000") && has(el("elimPremiosResumo").innerHTML, "2º → R$ 500"), "C4 as premiações aceitas aparecem como pílulas abaixo do campo");
const prin = el("elimPrincipal").innerHTML;
assert(has(prin, "SUPERLIGA TESTE") && has(prin, "Resultado final") && has(prin, "Time 104") && has(prin, "Ganho: R$ 1.000") && has(prin, "Ganho: R$ 500"), "C3 a visão principal mostra os CAMPEÕES/premiados com os valores da faixa");

// ---------- D · status FINALIZADA + último eliminado + faixa agora ----------
assert(has(prin, "competição FINALIZADA"), "D1 o status mostra a competição FINALIZADA (rodadas 30–34 todas com pontuação)");
assert(has(prin, "Último eliminado: <b>Time 103</b> (rodada 32)"), "D2 a visão principal marca o ÚLTIMO ELIMINADO e a rodada em que saiu");
assert(has(prin, "podio-tit") && has(prin, "podio-col ouro") && has(prin, "Ganho: R$ 1.000"), "D3 o PÓDIO com os classificados e os valores ganhos aparece na visão principal");

// ---------- E · em andamento ----------
el("elimCodigos").value = "201;202;203"; // 3 reforços: 7 times → com regra 1 sobram 2 após 5 rodadas
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
el("elimRodFim").value = "38";
await el("elimRodFim")._ls.change();
await sleep(30);
assert((el("elimChips").innerHTML.match(/elim-chip/g) || []).length === 7, "E0 os reforços entraram (7 times na competição)");
assert(has(el("elimPrincipal").innerHTML, "Rodada 35 em andamento"), "E1 sem terminar a competição (fim na rodada 38, atual 35, 2 na disputa): status EM ANDAMENTO");
assert(!has(el("elimPrincipal").innerHTML, "competição FINALIZADA"), "E2 e não aparece como finalizada");
assert(has(el("elimPrincipal").innerHTML, "Se terminasse hoje") && has(el("elimPrincipal").innerHTML, "Time 104") && has(el("elimPrincipal").innerHTML, "A ganhar: R$ 1.000"), "E3 em andamento: o cartão mostra quem SERIA campeão e os prêmios de hoje");
const projTab = el("elimTabela").innerHTML;
if(!(has(projTab, "posição de CAMPEÃO") && has(projTab, "se terminar hoje: R$ 1.000") && has(projTab, "se terminar hoje: R$ 500"))) {
  console.error("DEBUG E4 linha1:", (projTab.split("<tbody>")[1] || "").split("</tr>")[0]);
}
assert(has(projTab, "posição de CAMPEÃO") && has(projTab, "se terminar hoje: R$ 1.000") && has(projTab, "se terminar hoje: R$ 500"), "E4 na classificação, quem TERIA as premiações aparece marcado na posição atual");

// ---------- F · exibição por aba de rodada ----------
const strip = el("elimRodadasStrip").innerHTML;
assert(has(strip, 'data-er="30"') && has(strip, 'data-er="34"') && has(strip, 'data-er="38"'), "F1 as abas de rodada cobrem a faixa da competição (R30…R38)");
assert(has(strip, 'class="er-btn ativo"'), "F2 a rodada mais recente disputada começa ativa");
await el("elimRodadasStrip")._ls.click({ target: { getAttribute: () => "31" } });
let rod = el("elimRodadaPainel").innerHTML;
assert(has(rod, "Rodada 31") && has(rod, "Eliminados nesta rodada") && has(rod, ">Time 201</span>") && has(rod, "Faixa de premiação nesta rodada"), "F3 a aba da rodada 31 mostra os ELIMINADOS da rodada e os premiados da rodada");
assert(has(rod, '>Time 201</span>') && String(rod).indexOf("1º") < String(rod).indexOf("Time 201") && has(rod, 'class="elim-linha-elim"'), "F4 a tabela da rodada traz a classificação pelos PONTOS DA RODADA, com o eliminado destacadodo até ela, com o eliminado destacado");
await el("elimRodadasStrip")._ls.click({ target: { getAttribute: () => "36" } });
rod = el("elimRodadaPainel").innerHTML;
assert(has(rod, "Ninguém foi eliminado nesta rodada") && has(rod, "ainda não disputada"), "F5 rodada futura (R36) não disputada e sem eliminação diz claramente");

// ---------- G · exportar no formato da importação ----------
await el("elimBtnExportar")._ls.click({ preventDefault() {} });
const exp = el("elimMsg").textContent;
assert(has(exp, "SUPERLIGA TESTE=>101;102;103;104;201;202;203"), "G1 o EXPORTAR devolve os CÓDIGOS dos times no formato NOME DA LIGA=>ID1;ID2;…");

// ---------- H · persistência completa ----------
const s2 = store.get("sf_eliminatoria_v2") || "";
assert(has(s2, '"liga":"SUPERLIGA TESTE"') && has(s2, '"rodInicio":30') && has(s2, '"rodFim":38') && has(s2, '"premios":[[1,1000],[2,500]]') && has(s2, '"regra":1'), "H2 liga, rodadas, premiação e regra ficam gravadas no navegador");

// ---------- I · limpar ----------
await el("elimBtnLimpar")._ls.click({ preventDefault() {} });
assert(has(el("elimChips").innerHTML, "Nenhum time cadastrado") && has(store.get("sf_eliminatoria_v2"), '"ids":[]') && has(el("elimHeadLiga").textContent, "liga em construção"), "I1 limpar esvazia a competição, regrava o registro e o cabeçalho volta ao estado inicial");

// ---------- J · regra: elimina a MENOR PONTUAÇÃO DA RODADA (não o acumulado) ----------
el("elimCodigos").value = "555;556;101;102";
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
el("elimRodInicio").value = "30";
el("elimRodFim").value = "33";
await el("elimRodFim")._ls.change();
await sleep(30);
await el("elimRodadasStrip")._ls.click({ target: { getAttribute: () => "32" } });
const rodJ = el("elimRodadaPainel").innerHTML;
const segJ = (rodJ.split("Eliminados nesta rodada")[1] || "").split("</div>")[0];
assert(has(segJ, "Time 555") && !has(segJ, "Time 556"), "J1 na rodada 32 sai quem pontuou MENOS NA RODADA (Time 555: 20 pts) e não o de menor acumulado (Time 556)");
assert(has(el("elimTabela").innerHTML, "eliminado na rodada 32") && has(el("elimPrincipal").innerHTML, "podio-col ouro") && has(el("elimPrincipal").innerHTML, "Time 556"), "J2 o Time 555 — com o MAIOR acumulado da competição — caiu; o campeão é o 556");

// ---------- K · encerra pelas rodadas (campeão = 1º da classificação da rodada) + premiações com ; ----------
el("elimPremios").value = "1 - 1000; 2-500;3-250"; // o formato do usuário: pos - valor; pos-valor;pos-valor
await el("elimPremios")._ls.change();
await sleep(30);
el("elimCodigos").value = "701;702;703;704;705";
await el("elimBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
el("elimRodInicio").value = "30";
el("elimRodFim").value = "32";
await el("elimRodFim")._ls.change();
await sleep(30);
const prinK = el("elimPrincipal").innerHTML;
assert(has(prinK, "competição FINALIZADA") && has(prinK, "podio-col ouro") && has(prinK, "Time 704"), "K1 encerrou pelas rodadas com 2 na disputa: o CAMPEÃO é o 1º da classificação da RODADA 32 (Time 704: 96 pts)");
assert(has(prinK, "podio-col prata") && has(prinK, "Time 703") && has(prinK, "Ganho: R$ 500"), "K2 o degrau de prata do PÓDIO mostra o 2º lugar e o valor ganho");
const tabK = el("elimTabela").innerHTML;
assert(has(tabK, "96") && has(tabK, "95") && has(tabK, "94") && has(tabK, "93") && !has(tabK, "285"), "K3 a coluna mostra os PONTOS DA RODADA 32 (96/95/94/93/92), não o total (285 não aparece)");
assert(has(el("elimPremiosResumo").innerHTML, "1º → R$ 1.000") && has(el("elimPremiosResumo").innerHTML, "2º → R$ 500") && has(el("elimPremiosResumo").innerHTML, "3º → R$ 250"), "K4 premiações digitadas com PONTO-E-VÍRGULA (pos - valor; pos-valor;pos-valor) são reconhecidas");

console.log(`\n=== v44 (eliminatória em competição): ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
