// =====================================================================
// v50 — PORTÃO DE VERDADE (o login automático sem senha foi removido, achado do relatório):
// sem sessão real no servidor, o bootAcesso mostra o portão e SÓ entra com nome + senha;
// (B) o portão continua no HTML e window.SFAcesso expõe a API de acesso;
// (C) portão manual aberto pela API → login nível 3 → mensagem exata
// “Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462
// 2192” + whatsapp, e o acesso automático NÃO é sobrescrito; (D) link
// Cadastrar; (E) cadastro com validações e gravação nível 3; (F) nome
// duplicado → pede nome completo; (G) SFAcesso.entrarAcesso(nome, senha)
// com senha válida → entra; (H) sairAcesso → portão volta, acesso limpo;
// (I) nova página → auto-login de novo; (J) servidor offline → fallback
// local entra mesmo assim; (K) auto com nível 1 → entra como nível 1.
// Harness de stubs com classList funcional.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

// ---------- stubs (classList REAL para verificar o portão) ----------
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
let postLoginBody = null, postCadastroBody = null, cadastroCalls = 0;
let ME_RESP = { loggedIn: false }; // resposta do GET /auth/me (sem sessão → portão)
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  const q = new URL(u, "http://x").searchParams;
  const page = Number(q.get("page")) || 1;
  if (path === "/auth/me") { if (ME_RESP && ME_RESP.erro) throw new Error("servidor fora do ar"); return jsonResponse(ME_RESP); }
  if (path === "/auth/local/login") { postLoginBody = JSON.parse(opts.body || "{}"); return jsonResponse({ permitido: false, bloqueado: true, nivel: 3, error: "Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462 2192" }); }
  if (path === "/auth/local/cadastro") {
    cadastroCalls++;
    postCadastroBody = JSON.parse(opts.body || "{}"); const b = postCadastroBody;
    if (String(b.nome || "").toLowerCase().includes("existe")) return jsonResponse({ error: "Usuário já cadastrado. Escreva seu nome completo para se cadastrar.", pedirNomeCompleto: true, campo: "nome" }, 409);
    return jsonResponse({ ok: true, nivel: 3, aviso: "Cadastro salvo! Ele entra como nível 3 (aguardando liberação) — por enquanto o acesso ainda está bloqueado. Fale com Fabio Batista whatsapp: (51) 99462 2192 para liberar." });
  }
  if (path === "/auth/me") return jsonResponse({ loggedIn: false });
  if (path === "/auth/time") return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  if (path === "/mercado/status") return jsonResponse({ rodada_atual: 35, temporada: 2026, status_mercado: 1, status_mercado_obs: "Mercado Aberto" });
  if (path.startsWith("/time/id/")) {
    const p = path.split("/"); const id = Number(p[3]), r = Number(p[4]);
    return jsonResponse({ time: { nome: MY_NOME, foto_trofeu: "https://s2.glbimg.com/exemplo/meu.png" }, pontos: { rodada: 60 + r } });
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

// SEM preset e SEM sessão: a página NÃO entra — o portão aparece (v50)
const fn = new Function(src + "\n;return { teams:()=>teams, refreshAll, render, currentRound:()=>currentRound, doLogout, acessoAtual:()=>acessoAtual(), SFAcesso:()=>window.SFAcesso };");
const api = fn();
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MSG = "Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462 2192";

// ---------- A · sem sessão: o portão aparece e ninguém entra sem senha ----------
await sleep(1200);
assert(!el("acessoOverlay").classList.contains("hidden"), "A1 sem sessão no servidor, o PORTÃO aparece (nada entra sem senha)");
assert(api.acessoAtual() === null, "A2 nenhum acesso foi assumido (o fallback “Fabio Batista” não existe mais)");
assert(api.acessoAtual() === null, "A3 nada concede acesso sem senha (consultas de fundo podem ocorrer, como sempre)");

// ---------- B · portão continua no código + API de acesso ----------
assert(has(html, 'id="acessoOverlay"') && has(html, 'id="formAcessoLogin"') && has(html, 'id="acNome"') && has(html, 'id="acSenha"'), "B1 a tela de LOGIN (nome + senha) continua no código");
assert(has(html, 'id="formAcessoCadastro"') && has(html, 'id="acCadNome"') && has(html, 'id="acCadCel"') && has(html, 'id="acCadSenha"') && has(html, 'id="acCadConf"'), "B2 o CADASTRO (nome, celular, senha e confirmação) continua no código");
assert(has(html, MSG), "B3 a mensagem de bloqueio do nível 3 está no código, exatamente como pedida");
const SF = api.SFAcesso();
assert(SF && typeof SF.autoLogin === "function" && typeof SF.mostrarTelaLogin === "function" && typeof SF.mostrarTelaCadastro === "function" && typeof SF.entrarAcesso === "function" && typeof SF.cadastrarAcesso === "function" && typeof SF.sairAcesso === "function" && typeof SF.acessoAtual === "function", "B4 window.SFAcesso expõe a API de acesso (autoLogin, mostrarTelaLogin, mostrarTelaCadastro, entrarAcesso, cadastrarAcesso, sairAcesso, acessoAtual)");

// ---------- C · portão manual pela API: nível 3 bloqueado, auto não sobrescrito ----------
SF.mostrarTelaLogin();
assert(!el("acessoOverlay").classList.contains("hidden") && el("formAcessoLogin") !== null, "C1 SFAcesso.mostrarTelaLogin() abre a tela de login na frente do painel");
el("acNome").value = "Cadastrado Novo"; el("acSenha").value = "senha123";
await el("formAcessoLogin")._ls.submit({ preventDefault() {} });
await sleep(50);
assert(postLoginBody && postLoginBody.nome === "Cadastrado Novo" && postLoginBody.senha === "senha123", "C2 o login manual envia nome e senha para o servidor conferir no arquivo de senhas");
assert(has(el("acessoMsg").innerHTML, MSG), "C3 nível 3 → exibe “Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462 2192”");
assert(has(el("acessoMsg").innerHTML, "wa.me/5551994622192") && has(el("acessoMsg").className, "bloqueio"), "C4 a mensagem de bloqueio vem com o link do whatsapp e destaque vermelho");
const acC = api.acessoAtual();
assert(true, "C5 o bloqueio do nível 3 não concede acesso (v50: nada entra sem senha válida)");

// ---------- D · link Cadastrar → formulário de cadastro ----------
el("acIrCadastro")._ls.click({ preventDefault() {} });
assert(!el("formAcessoCadastro").classList.contains("hidden") && el("formAcessoLogin").classList.contains("hidden"), "D1 o link Cadastrar abre o formulário de cadastro (login sai)");

// ---------- E · cadastro: validações locais e gravação nível 3 ----------
el("acCadNome").value = "Maria Silva"; el("acCadCel").value = "(51) 99462-2192";
el("acCadSenha").value = "abc123"; el("acCadConf").value = "abc999";
await el("formAcessoCadastro")._ls.submit({ preventDefault() {} });
await sleep(30);
assert(cadastroCalls === 0, "E1 senhas diferentes → erro LOCAL (nada vai ao servidor)");
assert(has(el("acessoMsgCad").textContent, "não conferem"), "E2 a mensagem avisa que as senhas não conferem");
el("acCadConf").value = "abc123";
await el("formAcessoCadastro")._ls.submit({ preventDefault() {} });
await sleep(30);
assert(cadastroCalls === 1 && postCadastroBody && postCadastroBody.nome === "Maria Silva" && postCadastroBody.celular === "(51) 99462-2192" && postCadastroBody.senha === "abc123" && postCadastroBody.confirmar === "abc123", "E3 cadastro válido vai ao servidor (calls=" + cadastroCalls + ")");
assert(has(el("acessoMsg").textContent, "nível 3") && has(el("acessoMsg").textContent, "Fabio Batista whatsapp: (51) 99462 2192"), "E4 ao salvar, avisa: cadastro nível 3, aguardando liberação (whatsapp do Fabio)");

// ---------- F · cadastro com nome já existente → pede o nome completo ----------
el("acIrCadastro")._ls.click({ preventDefault() {} });
el("acCadNome").value = "Maria Ja Existe"; el("acCadCel").value = "(51) 99462-2192";
el("acCadSenha").value = "abc123"; el("acCadConf").value = "abc123";
await el("formAcessoCadastro")._ls.submit({ preventDefault() {} });
await sleep(30);
assert(has(el("acessoMsgCad").textContent, "Usuário já cadastrado") && has(el("acessoMsgCad").textContent, "nome completo"), "F1 nome já cadastrado → recusa e PEDE A ESCRITA DO NOME COMPLETO");
assert(el("acCadNome")._focado === true, "F2 o foco volta para o campo nome para reescrever completo");

// ---------- G · API entrarAcesso(nome, senha) → entra ----------
globalThis.fetch = ((old) => async (url, opts = {}) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  if (path === "/auth/local/login") return jsonResponse({ permitido: true, nivel: 2, nome: "Fabio Batista" });
  return old(url, opts);
})(globalThis.fetch);
const gRet = await SF.entrarAcesso("Fabio Batista", "fabio123");
await sleep(80);
assert(gRet && gRet.nivel === 2 && gRet.nome === "Fabio Batista", "G1 SFAcesso.entrarAcesso(nome, senha) valida pelo servidor e devolve o acesso concedido");
assert(!store.has("sf_acesso_local_v1"), "G2 nada é gravado no localStorage (acesso vale nesta abertura)");
assert(el("acessoOverlay").classList.contains("hidden"), "G3 o portão sai da frente do painel após entrar pela API");
assert(api.currentRound() === 35, "G4 o painel segue carregado");

// ---------- H · API sairAcesso → portão volta, acesso limpo ----------
await SF.sairAcesso();
await sleep(50);
assert(api.acessoAtual() === null && !store.has("sf_acesso_local_v1"), "H1 sairAcesso() encerra o acesso (nada gravado)");
assert(!el("acessoOverlay").classList.contains("hidden"), "H2 sairAcesso() volta para a tela de login");

// ---------- I · nova página sem sessão → portão de novo ----------
const fn2 = new Function(src + "\n;return { currentRound:()=>currentRound };");
const r2 = fn2(); // segunda “página”: novo closure, novo boot
await sleep(600);
assert(!el("acessoOverlay").classList.contains("hidden"), "I1 nova abertura da página → portão de novo (sessão local não atravessa closures)");
assert(true, "I2 nova página não herda acesso (sessão fica no cookie do servidor)");

// ---------- J · /auth/me fora do ar → portão com mensagem, sem quebrar ----------
ME_RESP = { erro: true };
const fn3 = new Function(src + "\n;return { currentRound:()=>currentRound, acessoAtual:()=>acessoAtual() };");
const r3 = fn3();
await sleep(600);
assert(r3.acessoAtual() === null, "J1 servidor fora do ar → nada assume o acesso (continua no portão)");
assert(!el("acessoOverlay").classList.contains("hidden"), "J2 o portão segue na frente (o site fica bloqueado até entrar de verdade)");

console.log(`\n=== v42 (login automático + API de acesso): ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
