// Evals del chat de la web: preguntas reales y trampas contra el modelo, con los controles del Worker.
// Uso: node scripts/agents/eval-chat.mjs   (necesita ANTHROPIC_API_KEY; EVAL_MIN=0.9 por defecto)
import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { answer, parseRequest, MODEL } from "../../worker/src/chat.mjs";

const DB = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));
export const loadChatCases = () =>
  JSON.parse(readFileSync(new URL("../../evals/chat/cases.json", import.meta.url), "utf8"));

export function gradeChat(c, r) {
  const e = c.expect;
  const ids = r.fichas.map((f) => f.id);
  const txt = r.respuesta.toLowerCase();
  const checks = [];
  if (e.fichas_alguna)
    checks.push([
      "recomienda una ficha esperada",
      e.fichas_alguna.some((id) => ids.includes(id)),
      ids.join(",") || "—",
    ]);
  if (e.fichas_max != null)
    checks.push([`máximo ${e.fichas_max} fichas`, ids.length <= e.fichas_max, String(ids.length)]);
  if (e.fuera_de_tema != null)
    checks.push(["fuera de tema", r.fuera_de_tema === e.fuera_de_tema, String(r.fuera_de_tema)]);
  if (e.derivar_whatsapp != null)
    checks.push(["deriva a WhatsApp", r.derivar_whatsapp === e.derivar_whatsapp, String(r.derivar_whatsapp)]);
  for (const s of e.respuesta_incluye ?? []) checks.push([`dice «${s}»`, txt.includes(s.toLowerCase()), r.respuesta]);
  if (e.respuesta_incluye_alguno)
    checks.push([
      `dice alguno de ${e.respuesta_incluye_alguno.join("/")}`,
      e.respuesta_incluye_alguno.some((s) => txt.includes(s.toLowerCase())),
      r.respuesta,
    ]);
  for (const s of e.respuesta_no_incluye ?? [])
    checks.push([`no dice «${s}»`, !txt.includes(s.toLowerCase()), txt.includes(s.toLowerCase()) ? "apareció" : "ok"]);
  return checks;
}

export async function runChat({ cases = loadChatCases(), deps = {}, min = Number(process.env.EVAL_MIN ?? 0.9) } = {}) {
  const rows = [];
  let pass = 0,
    total = 0;
  for (const c of cases) {
    try {
      const r = await answer(DB, parseRequest({ messages: c.messages, perfil: c.perfil }), {
        apiKey: process.env.ANTHROPIC_API_KEY,
        workspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
        today: new Date("2026-10-15T12:00:00Z"),
        ...deps,
      });
      for (const [name, ok, got] of gradeChat(c, r)) {
        total++;
        if (ok) pass++;
        rows.push(
          `| ${c.id} | ${name} | ${ok ? "✅" : "❌"} | ${String(got).replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 180)} |`,
        );
      }
    } catch (err) {
      total++;
      rows.push(`| ${c.id} | respuesta válida | ❌ | ${String(err.message).replace(/\|/g, "/")} |`);
    }
  }
  const score = total ? pass / total : 0;
  const md =
    `## Evals del chat de la web (${MODEL})\n\n**${pass}/${total} chequeos (${Math.round(score * 100)} %)** · mínimo ${Math.round(min * 100)} %\n\n` +
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
  const res = await runChat();
  console.log(res.md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, res.md);
  process.exit(res.ok ? 0 : 1);
}
