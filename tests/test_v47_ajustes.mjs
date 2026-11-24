// v47 — (A) menu de abas desce abaixo do minibar (os dois visíveis); (B) pódio com a
// pontuação de cada time nos degraus; (C) cards de time compactos e iguais nas duas abas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

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

const fn = new Function(src + "\n;return {};");
fn();
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- A · menu desce abaixo do minibar (os dois visíveis) ----------
assert(has(src, "m.style.top=(mb.classList.contains(\"show\")&&mb.offsetHeight>0?Math.round(mb.offsetHeight):0)+\"px\""), "A1 ao rolar, o MENU DE ABAS desce para baixo do minibar (os dois visíveis, nada sobrepõe)");
assert(has(html, "details.fold,section.panel,.elim-monta,.elim-principal{scroll-margin-top:116px}"), "A2 o scroll-margin das seções acompanha menu + minibar (116px)");

// ---------- B · pódio com as pontuações ----------
assert(has(src, "const pts=e.pts?'<span class=\"podio-pts\">'+e.pts+\"</span>\":\"\";"), "B1 o degrau do pódio renderiza a pontuação do time");
assert(has(html, ".podio-pts{font-size:12px;font-weight:800;color:#44598a"), "B2 a pontuação tem estilo próprio (pill discreta, agora ≥12px por acessibilidade)");
assert(has(src, "formatPoints(mensAcum(e.t,rodFim))+\" pts\""), "B3 na MENSAL o degrau mostra a SOMA da competição");
assert(has(src, "formatPoints(elimAcum(e.t,rodFim))+\" pts\"") && has(src, "formatPoints((e.t.scores||{})[rodRef])+\" pts\""), "B4 na ELIMINATÓRIA: rodada que posiciona (em andamento) e acumulado (encerrada)");

// runtime: mensal em andamento → degraus com "A ganhar" E a pontuação da soma
el("abaBtnMensal")._ls.click({ preventDefault() {} });
el("mensCodigos").value = "MENSAL TESTE=>101;102;103;104";
el("mensRodInicio").value = "30";
el("mensRodFim").value = "34";
el("mensRodFim")._ls.change();
el("mensPremios").value = "1 - 1000; 2-500;3-250";
el("mensPremios")._ls.change();
await el("mensBtnCadastrar")._ls.click({ preventDefault() {} });
await sleep(2200);
const prinM = el("mensPrincipal").innerHTML;
assert(has(prinM, "podio-pts") && has(prinM, "pts"), "B5 o pódio da MENSAL mostra a pontuação de cada classificado");

// runtime: eliminatória 30–34 → encerrada → "Ganho" + pontuação acumulada
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
assert(has(prinE, "podio-pts") && has(prinE, "Ganho: R$ 1.000"), "B6 o pódio da ELIMINATÓRIA encerrada mostra Ganho + pontuação acumulada");

// ---------- C · cards de time compactos e iguais nas duas abas ----------
assert(has(html, ".elim-chip{font-size:12px;padding:3px 8px;gap:5px}") && has(html, ".elim-chip img{width:16px;height:16px}"), "C1 os chips de times ficam COMPACTOS (fonte ≥12px por acessibilidade v50)");
assert(has(html, ".podio-escudo{width:36px;height:36px") && has(html, ".podio-degrau{align-self:stretch;margin-top:5px;padding:6px 0 5px;text-align:center;font-weight:900;font-size:12.5px"), "C2 os cards do pódio ficam mais compactos (igual nas duas abas)");

console.log(`\n=== v47 (menu/minibar + pódio com pontos + compacto): ${pass} ok, ${fail} falharam ===`);
if (fail) process.exit(1);
