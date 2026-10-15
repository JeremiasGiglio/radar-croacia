// Agente que resume: toma lo nuevo de la cola de revisión, lee la página oficial y deja un BORRADOR de ficha.
// Nada se publica solo: el borrador queda en review/queue/ y lo aprueba una persona en el PR.
import { readFileSync, writeFileSync, readdirSync, appendFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { callClaude } from "./claude.mjs";
import { applyGuardrails, toFicha } from "./guardrails.mjs";
import { fetchPageText } from "../lib/page.mjs";
import { MODEL } from "./prompt.mjs";

// Precio de referencia de Claude Haiku 5.5 (USD por millón de tokens) para el resumen de costos.
const PRICE = { input: 0.1, output: 0.5 };

/**
 * Genera el borrador de un ítem.
 * @param {{guid:string,title:string,link:string,published?:string|null,summary?:string,sourceName?:string}} item
 * @param {{getText?:(url:string)=>Promise<string>, callModel?:typeof callClaude}} deps
 */
export async function draftItem(item, { getText = fetchPageText, callModel = callClaude } = {}) {
  let text, textFrom;
  try {
    text = await getText(item.link);
    textFrom = "página oficial";
  } catch (e) {
    text = `${item.title}\n${item.summary ?? ""}`;
    textFrom = `solo el resumen del feed (no se pudo leer la página: ${e.message})`;
  }
  const { draft, usage } = await callModel(item, text);
  const { draft: safe, notes } = applyGuardrails(draft, text);
  if (textFrom !== "página oficial") notes.push(`El borrador se hizo con ${textFrom}.`);
  return { raw: draft, draft: safe, notes, ficha: toFicha(safe, item, notes), usage, text_from: textFrom };
}

const estadoTxt = { ok: "✅", cond: "🟡", no: "⛔" };

function markdownFor(item, r) {
  const d = r.draft;
  const lines = [
    `### ${d.relevante ? "⭐" : "·"} ${d.t}`,
    `[${item.title}](${item.link})`,
    "",
    `- **Sirve a la diáspora:** ${d.relevante ? "sí" : "no"}. ${d.motivo_relevancia}`,
    `- **Quién:** ${d.who}`,
    `- **Monto:** ${d.amount ?? "— (no figura en la fuente)"}`,
    `- **Plazo:** ${d.deadline ?? "— (no figura en la fuente)"}`,
    `- **Perfiles:** ar ${estadoTxt[d.el.ar.estado]} · cit ${estadoTxt[d.el.cit.estado]} · res ${estadoTxt[d.el.res.estado]}`,
    `- **Qué es:** ${d.what}`,
  ];
  const flags = [...(d.notas_revision ?? []), ...r.notes];
  if (flags.length) lines.push(`- **Revisar:** ${flags.join(" ")}`);
  return lines.join("\n");
}

export async function main({
  root = new URL("../../", import.meta.url),
  env = process.env,
  today = new Date().toISOString().slice(0, 10),
  deps = {},
} = {}) {
  const log = [];
  if (!env.ANTHROPIC_API_KEY && !deps.callModel) {
    console.log("Sin ANTHROPIC_API_KEY: no se generan borradores con IA.");
    return { drafted: 0, skipped: true };
  }
  const max = Number(env.RADAR_MAX_DRAFTS ?? 12);
  const qdir = new URL("review/queue/", root);
  const files = existsSync(qdir) ? readdirSync(qdir).filter((f) => f.startsWith(today) && f.endsWith(".json")) : [];
  let drafted = 0,
    tokensIn = 0,
    tokensOut = 0;
  const sections = [];

  for (const f of files) {
    const file = new URL(f, qdir);
    const q = JSON.parse(readFileSync(file, "utf8"));
    q.borradores ??= [];
    const done = new Set(q.borradores.map((b) => b.guid));
    for (const it of [...(q.added ?? []), ...(q.changed ?? [])]) {
      if (done.has(it.guid)) continue;
      if (drafted >= max) {
        log.push(`Se alcanzó el máximo de ${max} borradores por corrida; el resto queda para mañana.`);
        break;
      }
      const item = { ...it, sourceName: q.name };
      try {
        const r = await draftItem(item, deps);
        drafted++;
        tokensIn += r.usage.input_tokens ?? 0;
        tokensOut += r.usage.output_tokens ?? 0;
        q.borradores.push({
          guid: it.guid,
          link: it.link,
          model: MODEL,
          generated_at: new Date().toISOString(),
          text_from: r.text_from,
          relevante: r.draft.relevante,
          motivo_relevancia: r.draft.motivo_relevancia,
          ficha: r.ficha,
          citas: { amount: r.draft.amount_cita, deadline: r.draft.deadline_cita },
        });
        sections.push(markdownFor(item, r));
      } catch (e) {
        log.push(`❌ No se pudo resumir «${it.title}»: ${e.message}`);
      }
      if (!deps.getText) await new Promise((r) => setTimeout(r, 2000));
    }
    writeFileSync(file, JSON.stringify(q, null, 1) + "\n");
  }

  const cost = (tokensIn * PRICE.input + tokensOut * PRICE.output) / 1e6;
  const md =
    `\n## Borradores de la IA (${MODEL}) — revisar antes de publicar\n\n` +
    (sections.length ? sections.join("\n\n") : "No hubo ítems nuevos para resumir.") +
    (log.length ? "\n\n" + log.join("\n") : "") +
    `\n\n_${drafted} borrador(es), ${tokensIn + tokensOut} tokens, costo estimado USD ${cost.toFixed(4)}. ` +
    `Los montos y plazos solo quedan si aparecen textuales en la fuente._\n`;
  const lastRun = new URL("review/last_run.md", root);
  if (existsSync(lastRun) || drafted) appendFileSync(lastRun, md);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  return { drafted, tokensIn, tokensOut, cost, log };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
