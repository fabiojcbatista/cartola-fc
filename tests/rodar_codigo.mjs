// Roda todos os testes do pacote, um por um, e resume o resultado.
// Uso: npm test  (ou: node tests/rodar_todos.mjs)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";

const pasta = dirname(fileURLToPath(import.meta.url));
const arquivos = readdirSync(pasta).filter(f => /^test_v.*\.mjs$/.test(f) && !f.includes("v40_server")).sort();
let ok = 0, falhas = [], maiorTempo = 0;
for (const f of arquivos) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(pasta, f)], { encoding: "utf8", timeout: 240000 });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  maiorTempo = Math.max(maiorTempo, +dt);
  const ultima = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "(sem saída)";
  const deuBoa = r.status === 0;
  if (deuBoa) ok++; else falhas.push(f);
  console.log((deuBoa ? "PASSOU  " : "FALHOU  ") + f + " (" + dt + "s)  " + ultima.slice(0, 110));
  if (!deuBoa && r.stderr) console.log("  erro: " + String(r.stderr).split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 200));
}
console.log("\n=== RESUMO: " + ok + "/" + arquivos.length + " baterias passaram ===");
if (falhas.length) { console.log("Falharam: " + falhas.join(", ")); process.exit(1); }
