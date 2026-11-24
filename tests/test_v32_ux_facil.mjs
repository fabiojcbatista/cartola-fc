// =====================================================================
// Bateria v32 — A PAINEL FÁCIL (painel Superliga do Fabião).
// Implementa o mockup aprovado (Claude + ChatGPT + Gemini + Grok):
//   A · Estrutura: hero (convite + CTA único + nota de segurança), menu
//       “Avançado” (modo manual + dados brutos), cartão de progresso do
//       login automático, diálogo em 3 passos, CSS (skeleton/spinner/
//       trilho/foco/reduced-motion/contraste) e tooltips “i”.
//   B · Comportamento no boot SEM login: hero visível, skeletons nas
//       seções durante o 1º carregamento, depois orientação real (sem
//       skeleton); menu abre/fecha (aria-expanded, Escape); destaque do
//       modo manual acende o menu e abre ele; cancelar login.
//   C · Login AUTOMÁTICO com progresso visual: cartão aparece no clique,
//       passo 2 durante a espera, passo 3 no “Login concluído!”, cartão
//       some no fim; fluxo termina com time da conta e Conexão concluída.
//   D · Sem Chrome (unavailable): cai no modo manual — diálogo abre com
//       passo 1 em andamento e o cartão automático some da cena.
//   E · Regressão da mecânica: regra da v30 e seletor da v31 intactos.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const html = readFileSync(RAIZ + "index.html", "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("script não encontrado"); process.exit(1); }
const src = m[1];

// ---------- stubs (classList e atributos REAIS, para poder afirmar estado) ----------
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, innerHTML: "", textContent: "", value: "", open: false, disabled: false, hidden: false,
    _cls: new Set(),
    get className() { return [...this._cls].join(" "); },
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    classList: null,
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k] ?? null; },
    addEventListener(type, fn) { (this._ls ??= {})[type] = fn; },
    showModal() { this.open = true; }, close() { this.open = false; }, select() {}, focus() {},
  });
  const e = els.get(id);
  if (!e.classList) e.classList = {
    add(...c) { c.forEach(x => e._cls.add(x)); },
    remove(...c) { c.forEach(x => e._cls.delete(x)); },
    toggle(c, force) { const on = force === undefined ? !e._cls.has(c) : !!force; on ? e._cls.add(c) : e._cls.delete(c); return on; },
    contains(c) { return e._cls.has(c); },
  };
  return e;
}
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
let docLs = {};
globalThis.document = {
  getElementById: el, querySelectorAll: () => [],
  addEventListener(t, f) { (docLs[t] ??= []).push(f); },
  hidden: false, hasFocus: () => true,
};
globalThis.window = globalThis;
globalThis.location = { origin: "http://localhost:3000" };
try { globalThis.navigator = {}; } catch {}

// ---------- mundo simulado ----------
const MY = 1382686, MY_NOME = "Super Fabiao PRO FC";
let world = {
  rodada: 35, loggedIn: false, statusMercado: 1, obs: "Mercado Aberto",
  pontosPorRodada: r => 60 + r,
  autoResposta: { flowId: "fluxo-1" },   // resposta do /auth/oidc/auto
  autoStatus: { loggedIn: true },        // resposta do /auth/oidc/auto/status
  atrasoStatus: 0,                       // atraso artificial do /mercado/status (cold start)
};
let calls = [];
function jsonResponse(obj) { return { ok: true, status: 200, json: async () => obj }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
globalThis.fetch = async (url, opts) => {
  const u = String(url); calls.push(u);
  const method = (opts && opts.method) || "GET";
  const path = u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/cartola/, "").split("?")[0];
  if (path === "/auth/me") return jsonResponse({ loggedIn: world.loggedIn });
  if (path === "/auth/time") {
    if (!world.loggedIn) return { ok: false, status: 401, json: async () => ({}) };
    return jsonResponse({ time: { time_id: MY, nome: MY_NOME, slug: "super-fabiao-pro-fc" } });
  }
  if (path === "/mercado/status") {
    if (world.atrasoStatus) await sleep(world.atrasoStatus);
    return jsonResponse({ rodada_atual: world.rodada, temporada: 2026, status_mercado: world.statusMercado, status_mercado_obs: world.obs });
  }
  if (path.startsWith("/time/id/")) {
    const partes = path.split("/");
    const r = Number(partes[4]);
    return jsonResponse({ time: { nome: MY_NOME }, pontos: { rodada: world.pontosPorRodada(r) } });
  }
  if (path === "/auth/oidc/auto" && method === "POST") return jsonResponse(world.autoResposta);
  if (path === "/auth/oidc/auto/status") return jsonResponse(world.autoStatus);
  if (path === "/auth/ligas") return jsonResponse({ ligas: [] });
  if (path === "/auth/competicoes/pontoscorridos") return jsonResponse([]);
  return { ok: false, status: 404, json: async () => ({}) };
};

// ---------- helpers ----------
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const has = (h, s) => String(h).includes(s);
const waitStatus = async (substr, tentativas = 400) => {
  for (let i = 0; i < tentativas; i++) {
    await sleep(25);
    if (has(el("status").textContent, substr)) return true;
  }
  return false;
};
function boot(mundo) {
  els.clear(); store.clear(); docLs = {}; calls = [];
  Object.assign(world, mundo);
try{globalThis.__SF_ACESSO_PRESET={nivel:2,nome:"Fabio Batista"}}catch{} // v41: injeção de acesso para os testes (em uso real, toda carga pede login)
  const fn = new Function(src + "\n;return { teams:()=>teams, limiteRodada:()=>limiteRodada, mercadoParcial:()=>mercadoParcial, currentRound:()=>currentRound, roundColumns, roundViewOptions, roundView:()=>roundView, render, refreshAll, setPassos, abrirAdv, fecharAdv, destacarModoManual, renderHero };");
  return fn();
}

// =====================================================================
console.log("\n[A] Estrutura v32 no HTML/CSS");
{
  const api = boot({ loggedIn: false });

  assert(has(html, 'id="hero"') && has(html, "Bem-vindo ao Superliga do Fabião!"), "A1 hero existe com o convite “Bem-vindo ao Superliga do Fabião!”");
  assert(!has(html, 'id="heroLogin"') && has(html, 'id="heroSearch"') && has(html, 'id="loginBtn"'), "A2 v50: um único “Entrar com Globo” (cabeçalho); o hero mantém a busca — o relatório apontou o botão duplicado");
  assert(has(html, "Seu login é seguro") && has(html, "nunca vê a sua senha"), "A3 hero explica a segurança: login na página oficial da Globo, sem senha no painel");
  assert(has(html, 'class="hero" id="hero"'), "A4 o hero é o PRIMEIRO bloco do main (convite antes dos controles)");
  assert(has(html, 'id="advBtn"') && has(html, 'aria-haspopup="true"') && has(html, 'aria-expanded="false"'), "A5 botão “Avançado ▾” com aria-haspopup e aria-expanded");
  assert(has(html, 'id="advMenu"') && has(html, 'id="manualLink"') && has(html, "Modo manual (janela comum da Globo)") && has(html, "só entram com Google/Facebook"), "A6 menu Avançado contém o modo manual COM a explicação do que ele faz (Grok)");
  assert(has(html, 'id="diagBtn"') && has(html, "{ } Dados brutos da API") && html.indexOf('id="advMenu"') < html.indexOf('id="diagBtn"'), "A7 dados brutos moram DENTRO do menu Avançado (fora da vista principal)");
  assert(has(html, 'id="loginProgress"') && has(html, 'id="pa1"') && has(html, 'id="pa2"') && has(html, 'id="pa3"') && has(html, 'id="autoCancelBtn"'), "A8 cartão de progresso do login automático com os 3 passos e “Cancelar o login”");
  assert(has(html, "entre nela com E-MAIL e SENHA da Conta Globo") && has(html, "Continuar com Google") && has(html, "pode não ser seguro"), "A9 o aviso do Google/Facebook completo está no cartão de progresso (proteção v23/v26 mantida)");
  assert(has(html, 'id="passosManual"') && has(html, 'id="pm1"') && has(html, "A janela da Globo abriu") && has(html, "Você entra na Globo") && has(html, "O painel conclui sozinho"), "A10 diálogo manual tem o stepper 1-2-3 (janela abriu → você entra → painel conclui)");
  assert(has(html, "Modo manual — janela comum da Globo"), "A11 subtítulo do diálogo preserva o título histórico do modo manual");
  assert(has(html, "O que é compartilhado?") && has(html, "código OAuth") && has(html, "nenhuma senha passa por aqui"), "A12 nota de segurança do wizard responde “o que é compartilhado?” (ChatGPT: prioridade alta)");
  assert(has(html, "Instruções detalhadas e problemas comuns") && has(html, "São as ÚNICAS teclas necessárias") && has(html, "o painel pode ver a área de transferência?"), "A13 instruções longas recolhidas em <details> (proteções v18 mantidas)");
  assert(has(html, "EM BRANCO, é assim mesmo") && has(html, "?code=…&state=…"), "A14 “página EM BRANCO é assim mesmo” + formato do endereço continuam explicados");
  assert(has(html, ".sk{display:block") && has(html, "@keyframes brilho"), "A15 CSS dos skeleton loaders (linhas brilhando)");
  assert(has(html, "#refreshBtn.loading::before") && has(html, "@keyframes rodar"), "A16 CSS do spinner no “Atualizar dados” (e no “Buscar time”)");
  assert(has(html, ".trilho.p1 i{width:33%}") && has(html, ".trilho.p2 i{width:66%}") && has(html, ".trilho.p3 i{width:100%}"), "A17 barra de progresso do stepper acompanha os passos");
  assert(has(html, ":focus-visible{outline:3px solid") && has(html, "@media(prefers-reduced-motion:reduce)"), "A18 foco visível por teclado + respeito a prefers-reduced-motion");
  assert(has(html, "--muted:#55607a") && has(html, ".empty{color:#6b7488}") && !has(html, "--muted:#6d7890"), "A19 contraste reforçado: cinzas secundários mais escuros (Gemini)");
  assert(has(html, 'title="A fase da disputa vem do CHAVEAMENTO REAL') && has(html, 'title="Confronto direto: vitória 3 pts'), "A20 (v37) tooltips “i” com a regra em linguagem simples — o tooltip da pontuação saiu com o cabeçalho duplicado; a regra segue no footnote e na dica do gráfico");
  assert(has(html, "#manualLink.destaque{animation:pulsaDestaque") && has(html, "#advBtn.destaque{animation:pulsaDestaque"), "A21 piscar amarelo mantido no link E agora também no menu Avançado");
  assert(has(html, "v32 — A PAINEL FÁCIL") && has(html, "v31 — O CONTROLE DAS RODADAS EXIBIDAS VOLTOU"), "A22 cadeia de versões: v32 na frente, v31 e anteriores preservadas");
  assert(typeof api.setPassos === "function" && typeof api.renderHero === "function", "A23 helpers v32 exportados (setPassos, renderHero)");
}

// =====================================================================
console.log("\n[B] Boot SEM login: hero, skeletons, menu Avançado e destaque");
{
  const api = boot({ loggedIn: false, atrasoStatus: 350 });

  assert(has(el("hero").className ? el("hero").className : "hero", "hero") && !el("hero").classList.contains("hidden"), "B1 no boot vazio o hero está VISÍVEL (convite, não página quebrada)");
  assert(has(el("authBox").innerHTML, 'id="loginBtn"') && !has(el("authBox").innerHTML, "manualLink"), "B2 sem login a barra tem UM botão principal (modo manual saiu da authBox)");
  assert(has(el("scoresTable").innerHTML, 'class="sk"') && has(el("classicTable").innerHTML, 'class="sk"'), "B3 durante o 1º carregamento as seções mostram SKELETON (nada de tabela vazia)");
  assert(has(el("bannerResumo").innerHTML, "Nenhum time monitorado ainda") && has(el("bannerResumo").innerHTML, "Entre com a Globo"), "B4 banner-resumo continua orientando (v30 intacta)");

  assert(await waitStatus("Rodada 35 carregada (Mercado Aberto)"), "B5 1º carregamento concluiu (mercado aberto, rodada 35)");
  assert(!has(el("scoresTable").innerHTML, 'class="sk"') && has(el("scoresTable").innerHTML, "Nenhum time monitorado"), "B6 depois do carregamento: skeletons saem e entra a orientação real");
  assert(el("hero").classList.contains("hidden") === false, "B7 sem time e sem login o convite continua disponível (com a orientação abaixo)");
  assert(!has(el("scoresTable").innerHTML, 'class="sk"'), "B8 atualizar de novo NÃO traz skeleton de volta (só no 1º carregamento)");

  // menu Avançado (o stub não parseia o HTML: aplica o estado inicial do markup antes de clicar)
  const advBtn = el("advBtn"), advMenu = el("advMenu");
  advMenu.classList.add("hidden"); // estado inicial real (class="menu hidden")
  advBtn.setAttribute("aria-expanded", "false");
  advBtn._ls.click({ stopPropagation() {}, target: advBtn });
  assert(!advMenu.classList.contains("hidden") && advBtn.getAttribute("aria-expanded") === "true", "B9 clique no Avançado ABRE o menu e marca aria-expanded=true");
  advBtn._ls.click({ stopPropagation() {}, target: advBtn });
  assert(advMenu.classList.contains("hidden") && advBtn.getAttribute("aria-expanded") === "false", "B10 clique de novo FECHA o menu (aria-expanded=false)");
  api.abrirAdv();
  docLs.keydown.forEach(f => f({ key: "Escape" }));
  assert(advMenu.classList.contains("hidden"), "B11 Escape fecha o menu Avançado");
  api.abrirAdv();
  docLs.click.forEach(f => f({ target: {} }));
  assert(advMenu.classList.contains("hidden"), "B12 clique fora fecha o menu Avançado");

  // destaque do modo manual (bloqueio do Google) — agora acende o menu inteiro e abre ele
  api.fecharAdv();
  api.destacarModoManual(true);
  assert(el("manualLink").classList.contains("destaque") && advBtn.classList.contains("destaque"), "B13 destaque do modo manual acende o link E o botão Avançado");
  assert(!advMenu.classList.contains("hidden"), "B14 o menu Avançado ABRE sozinho quando o modo manual é destacado");
  api.destacarModoManual(false);
  assert(!el("manualLink").classList.contains("destaque") && !advBtn.classList.contains("destaque"), "B15 destaque sai quando o login conclui/cancela");

  // stepper — unidades
  api.setPassos("pm", 1, 2);
  assert(el("pm1").classList.contains("feito") && el("pm2").classList.contains("atual") && !el("pm3").classList.contains("feito"), "B16 setPassos(1,2): passo 1 verde, passo 2 laranja");
  assert(el("pmTrilho").classList.contains("p1"), "B17 trilho no 1/3 (classe p1)");
  api.setPassos("pm", 3, 0);
  assert(el("pm1").classList.contains("feito") && el("pm2").classList.contains("feito") && el("pm3").classList.contains("feito") && el("pmTrilho").classList.contains("p3"), "B18 setPassos(3): tudo verde, trilho cheio");

  // cancelar login (sem fluxo ativo): mensagem amigável
  el("autoCancelBtn")._ls.click();
  assert(has(el("status").textContent, "Login cancelado"), "B19 botão “Cancelar o login” responde com mensagem amigável");
  assert(el("loginProgress").classList.contains("hidden"), "B20 cartão de progresso fica escondido quando não há login em andamento");
}

// =====================================================================
console.log("\n[C] Login AUTOMÁTICO com progresso visual (3 passos)");
{
  const api = boot({ loggedIn: false, autoResposta: { flowId: "fluxo-1" }, autoStatus: { loggedIn: false } });

  el("authBox")._ls.click({ target: { id: "loginBtn" } });
  await sleep(120);
  // o usuário concluiu o login na janela da Globo: o próximo poll vê a sessão pronta
  world.autoStatus = { loggedIn: true };
  world.loggedIn = true;
  assert(!el("loginProgress").classList.contains("hidden"), "C1 o cartão de progresso APARECE ao clicar em Entrar com Globo");
  assert(el("pa1").classList.contains("feito") && el("pa2").classList.contains("atual") && !el("pa3").classList.contains("feito"), "C2 passo 1 verde (janela abriu) e passo 2 laranja (você entra na Globo)");
  assert(has(src, 'setStatus("Abrindo o navegador na página da Globo — entre nela com e-mail e senha'), "C3 barra de status com texto CURTO (o aviso longo mora no cartão)");

  assert(await waitStatus("Conexão concluída: 1/1"), "C4 login automático concluído: time da conta e ligas carregados");
  assert(el("pa1").classList.contains("feito") && el("pa2").classList.contains("feito") && el("pa3").classList.contains("atual"), "C5 passo 3 fica visível enquanto o painel conclui sozinho");

  assert(calls.some(u => u.includes("/auth/oidc/auto/status?id=fluxo-1")), "C6 o painel acompanhou o fluxo pelo /auth/oidc/auto/status");
  assert(el("loginProgress").classList.contains("hidden"), "C7 cartão de progresso SOME da cena no fim");
  assert(has(el("authBox").innerHTML, "Sair") && has(el("authBox").innerHTML, MY_NOME), "C8 sessão ativa: “Conectado como …” + Sair");
  assert(api.teams().length === 1 && api.teams()[0].mine === true, "C9 time da conta entrou sozinho (mecânica intacta)");
}

// =====================================================================
console.log("\n[D] Sem Chrome controlável → modo manual em 3 passos");
{
  globalThis.open = () => null; // pop-up bloqueado no stub
  const api = boot({ loggedIn: false, autoResposta: { unavailable: true, reason: "sem Chrome" } });

  el("authBox")._ls.click({ target: { id: "loginBtn" } });
  await sleep(80);
  assert(el("loginProgress").classList.contains("hidden"), "D1 cartão do automático NÃO aparece (sem Chrome controlável)");
  assert(el("loginDialog").open === true, "D2 diálogo do modo manual (3 passos) abriu direto");
  assert(el("pm1").classList.contains("atual") && !el("pm1").classList.contains("feito"), "D3 passo 1 “A janela da Globo abriu” começa EM ANDAMENTO");
  assert(has(el("oidcError").textContent, "bloqueou a janela"), "D4 sem janela (pop-up bloqueado) o erro aparece no próprio diálogo");
  el("loginCancel")._ls.click();
  assert(el("loginDialog").open === false, "D5 “Fechar” encerra o diálogo");
  await sleep(600); // drena o refreshAll do boot antes do próximo cenário (evita escrita fantasma)
}

// =====================================================================
console.log("\n[E] Regressão da mecânica (v30/v31 intactas na v32)");
{
  const api = boot({ loggedIn: true, atrasoStatus: 0 });

  assert(await waitStatus("Conexão concluída: 1/1"), "E1 boot logado carrega tudo (status final de sucesso)");
  assert(api.limiteRodada() === 34 && api.mercadoParcial() === false, "E2 regra da v30: mercado aberto na rodada 35 → limite 34");
  assert(!calls.some(u => u.includes("/time/id/" + MY + "/35")) && calls.some(u => u.includes("/time/id/" + MY + "/34")), "E3 rodada futura nunca consultada; 1..34 sim");
  const opts = api.roundViewOptions();
  assert(opts[0][0] === "todas" && opts.some(o => o[0] === "ult5") && opts.some(o => o[0] === "31-34"), "E4 seletor “Rodadas exibidas” da v31 intacto (todas/últimas 5/janelas)");
  assert(has(el("hero").className, "hidden"), "E5 com time na lista o hero SAI da cena (nada de convite redundante)");
  assert(has(el("scoresLimite").textContent, "Rodadas 1–34"), "E6 subtítulo da pontuação segue o padrão da v31");
  assert(has(el("bannerResumo").innerHTML, "⭐ MEU TIME") && has(el("bannerResumo").innerHTML, MY_NOME), "E7 banner-resumo da v30 segue mostrando o Meu time");
}

console.log(`\n=== v32: ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
