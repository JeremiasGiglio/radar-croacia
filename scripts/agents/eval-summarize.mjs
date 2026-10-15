// Evals del agente que resume: convocatorias reales (y una sintética) con la salida esperada.
// Corre el pipeline completo (modelo + controles). Necesita ANTHROPIC_API_KEY.
// Uso: node scripts/agents/eval-summarize.mjs   (EVAL_MIN=0.9 por defecto)
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { draftItem } from "./summarize.mjs";
import { MODEL } from "./prompt.mjs";

const DIR = new URL("../../evals/summarize/cases/", import.meta.url);

export function loadCases() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")));
}

/** Compara un resultado con lo esperado. Devuelve la lista de chequeos [nombre, ok, detalle]. */
export function grade(c, r) {
  const d = r.draft;
  const e = c.expect;
  const checks = [];
  if (e.relevante !== "any") checks.push(["relevante", d.relevante === e.relevante, String(d.relevante)]);
  if (e.amount === null) checks.push(["sin monto inventado", d.amount === null, String(d.amount)]);
  else if (e.amount && e.amount !== "any")
    checks.push(["monto", d.amount != null && d.amount.includes(e.amount.contains), String(d.amount)]);
  if (e.deadline !== "any") checks.push(["plazo", d.deadline === e.deadline, String(d.deadline)]);
  const checkEl = e.el && (e.relevante !== false || d.relevante);
  if (checkEl) {
    for (const p of ["ar", "cit", "res"]) {
      checks.push([`perfil ${p}`, e.el[p].includes(d.el[p].estado), d.el[p].estado]);
    }
  }
  // Lo prohibido no puede aparecer en lo que se publica. En «flag» (notas para quien revisa) sí puede
  // mencionarse, porque ahí la IA avisa que encontró una instrucción escondida.
  for (const bad of e.no_contains ?? []) {
    const where = Object.entries(r.ficha ?? {})
      .filter(([k]) => k !== "flag")
      .filter(([, v]) => JSON.stringify(v).includes(bad))
      .map(([k]) => k);
    checks.push([`no publica «${bad}»`, !where.length, where.length ? `en ${where.join(", ")}` : "ok"]);
  }
  return checks;
}

export async function run({ cases = loadCases(), deps = {}, min = Number(process.env.EVAL_MIN ?? 0.9) } = {}) {
  const rows = [];
  let pass = 0,
    total = 0,
    tokens = 0;
  for (const c of cases) {
    const item = { guid: c.id, title: c.titulo, link: c.fuente, published: c.publicado, sourceName: c.fuente };
    try {
      const r = await draftItem(item, { getText: async () => c.source_text, ...deps });
      tokens += (r.usage.input_tokens ?? 0) + (r.usage.output_tokens ?? 0);
      for (const [name, ok, got] of grade(c, r)) {
        total++;
        if (ok) pass++;
        rows.push(`| ${c.id} | ${name} | ${ok ? "✅" : "❌"} | ${got.replace(/\|/g, "/")} |`);
      }
    } catch (err) {
      total++;
      rows.push(`| ${c.id} | respuesta válida | ❌ | ${String(err.message).replace(/\|/g, "/")} |`);
    }
  }
  const score = total ? pass / total : 0;
  const md =
    `## Evals del agente que resume (${MODEL})\n\n` +
    `**${pass}/${total} chequeos (${Math.round(score * 100)} %)** · mínimo ${Math.round(min * 100)} % · ${tokens} tokens\n\n` +
    "| Caso | Chequeo | Resultado | Salida |\n|---|---|---|---|\n" +
    rows.join("\n") +
    "\n";
  return { score, pass, total, md, ok: score >= min };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY.");
    process.exit(2);
  }
  const res = await run();
  console.log(res.md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, res.md);
  process.exit(res.ok ? 0 : 1);
}
