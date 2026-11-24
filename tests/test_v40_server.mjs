// =====================================================================
// v40 — SERVIDOR REAL (HTTP): sobe o server.js numa porta efêmera com o
// arquivo “passwords” temporário e valida o fluxo completo:
//   1. cadastro novo → grava linha “nome;celular;3;senha” no arquivo;
//   2. cadastro com o MESMO nome (mesmo mudando maiúsculas) → recusa e
//      pede o nome completo (409);
//   3. login com a conta nível 3 → bloqueado com a mensagem exata;
//   4. login com senha errada → 401;
//   5. contas nível 1 e 2 criadas à mão no arquivo → login aceito;
//   6. validações (senhas não conferem, celular inválido, campos vazios);
//   7. POST /auth/local/auto (v42, login automático): conta marcada “auto”, sem marca usa a
//      primeira nível 2, nível 3 nunca entra, arquivo vazio → padrão; login manual intacto.
// =====================================================================
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // pasta do projeto, funciona em qualquer máquina

const PORT = 3577;
const BASE = "http://127.0.0.1:" + PORT;
const PASSFILE = (await import("node:path")).join((await import("node:os")).tmpdir(), "sf_test_acessos.json");
try { rmSync(PASSFILE, { force: true }); } catch {}
const FIXTURE =
  "# Superliga do Fabião — base de acesso (v40/v42)\n# formato de cada linha: nome;celular;nivel;senha (5º campo “auto” = login automático)\n" +
  "Fabio Batista;(51) 99462-2192;1;fabio123\n" +
  "Cartola Chefe;(51) 99999-7777;2;chefinho789\n" +
  "Gerente Da Liga;(51) 99999-8888;2;gerente456;auto\n";
writeFileSync(PASSFILE, FIXTURE);

const proc = spawn("node", ["server.js"], {
  cwd: RAIZ.replace(/[\\/]$/, ""),
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", SF_PASSWORDS_PATH: PASSFILE },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
proc.stdout.on("data", d => log += d);
proc.stderr.on("data", d => log += d);
await new Promise(r => setTimeout(r, 1200));

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("ok –", msg); } else { fail++; console.error("FALHOU:", msg); } };
const MSG = "Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462 2192";
async function post(path, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// aguarda o servidor responder
let noAr = false;
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(BASE + "/auth/me"); if (r.ok) { noAr = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 400));
}
assert(noAr, "S0 o servidor subiu na porta " + PORT);

// 1. cadastro novo → arquivo com nível 3
const cad = await post("/auth/local/cadastro", { nome: "Maria Silva", celular: "(51) 99462-2192", senha: "abc123", confirmar: "abc123" });
assert(cad.status === 200 && cad.data.ok === true && cad.data.nivel === 3, "S1 cadastro novo aceito e marcado como NÍVEL 3");
const conteudo = readFileSync(PASSFILE, "utf8");
assert(conteudo.includes("Maria Silva;(51) 99462-2192;3;scrypt$"), "S2 v50: o cadastro gravou a linha com HASH (nome;celular;3;scrypt$…)");

// 2. mesmo nome (maiúsculas/acentos à parte) → recusa pedindo nome completo
const dup = await post("/auth/local/cadastro", { nome: "maria silva", celular: "(51) 99999-0000", senha: "xyz789", confirmar: "xyz789" });
assert(dup.status === 409 && dup.data.pedirNomeCompleto === true, "S3 cadastro com MESMO nome (case-insensitive) → recusado (409) pedindo nome completo");
assert(has => null || (dup.data.error || "").includes("Usuário já cadastrado") && (dup.data.error || "").includes("nome completo"), "S4 a mensagem pede a escrita do nome completo");

// 3. login nível 3 → bloqueado com a mensagem exata
const lg3 = await post("/auth/local/login", { nome: "Maria Silva", senha: "abc123" });
assert(lg3.status === 200 && lg3.data.permitido === false && lg3.data.bloqueado === true && lg3.data.nivel === 3, "S5 login da conta nível 3 → BLOQUEADO");
assert(lg3.data.error === MSG, "S6 a mensagem é exatamente “Usuário não permitido, fala com Fabio Batista whatsapp: (51) 99462 2192”");

// 4. senha errada → 401
const lgErr = await post("/auth/local/login", { nome: "Fabio Batista", senha: "errada123" });
assert(lgErr.status === 401 && (lgErr.data.error || "").includes("incorretos"), "S7 senha errada → 401 “Nome ou senha incorretos”");

// 5. nível 1 e 2 criados à mão → aceitos
const lg1 = await post("/auth/local/login", { nome: "fabio batista", senha: "fabio123" });
assert(lg1.status === 200 && lg1.data.permitido === true && lg1.data.nivel === 1, "S8 nível 1 (nome em minúsculas) → PERMITIDO, entra no site");
const lg2 = await post("/auth/local/login", { nome: "Gerente da Liga", senha: "gerente456" });
assert(lg2.status === 200 && lg2.data.permitido === true && lg2.data.nivel === 2, "S9 nível 2 → PERMITIDO, entra no site");

// 6. validações do cadastro
const conf = await post("/auth/local/cadastro", { nome: "Outra Pessoa", celular: "(51) 99999-7777", senha: "abc123", confirmar: "abc999" });
assert(conf.status === 400 && (conf.data.error || "").includes("não conferem"), "S10 confirmação diferente da senha → 400");
const cel = await post("/auth/local/cadastro", { nome: "Outra Pessoa", celular: "999", senha: "abc123", confirmar: "abc123" });
assert(cel.status === 400 && cel.data.campo === "celular", "S11 celular inválido → 400 apontando o campo");
const vazio = await post("/auth/local/login", { nome: "", senha: "" });
assert(vazio.status === 400, "S12 login sem nome/senha → 400");
const pontoVirgula = await post("/auth/local/cadastro", { nome: "Nome;Malicioso", celular: "(51) 99999-7777", senha: "abc123", confirmar: "abc123" });
assert(pontoVirgula.status === 400, "S13 “;” no nome → 400 (protege o formato do arquivo)");

// CSRF: Origin de outro site → 403
try {
  const r = await fetch(BASE + "/auth/local/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://site-malicioso.example" }, body: JSON.stringify({ nome: "x", senha: "y" }) });
  assert(r.status === 403, "S14 POST com Origin estranho → 403 (proteção same-origin mantida)");
} catch (e) { assert(false, "S14 POST com Origin estranho → 403 (" + e.message + ")"); }

// ---------- 7. v50 · o login automático SEM SENHA não existe mais; o login COM senha entra
// (as linhas do arquivo de teste estão em texto puro — o 1º login certo converte para hash)
const autoX = await post("/auth/local/auto", {});
assert(autoX.status === 404, "S15 v50: POST /auth/local/auto NÃO existe mais (nada entra sem senha)");
const okUp = await post("/auth/local/login", { nome: "Gerente Da Liga", senha: "gerente456" });
assert(okUp.status === 200 && okUp.data.permitido === true, "S16 v50: login com senha certa entra mesmo com linha antiga (upgrade para hash)");
let hashOk = false;
try { hashOk = readFileSync(PASSFILE, "utf8").includes("scrypt$"); } catch {}
assert(hashOk, "S17 v50: a senha virou HASH scrypt no arquivo (nada mais em texto puro)");
writeFileSync(PASSFILE, "# só comentários\n", "utf8");
const vazio40 = await post("/auth/local/login", { nome: "Qualquer Um", senha: "qualquer" });
assert(vazio40.status === 401, "S18 v50: arquivo vazio → ninguém entra (não existe mais conta padrão sem senha)");
writeFileSync(PASSFILE, FIXTURE);
const lgManual = await post("/auth/local/login", { nome: "Gerente Da Liga", senha: "gerente456" });
assert(lgManual.status === 200 && lgManual.data.permitido === true && lgManual.data.nivel === 2, "S19 o login MANUAL com senha segue intacto (funcionalidade preservada para API)");

proc.kill();
await new Promise(r => setTimeout(r, 300));
try { rmSync(PASSFILE, { force: true }); } catch {}
if (fail) console.error("log do servidor:\n" + log.slice(-800));
console.log(`\n=== v40 (servidor): ${pass} ok, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
