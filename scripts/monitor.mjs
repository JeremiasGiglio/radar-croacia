// Robot diario: lee cada fuente, guarda la versión en data/sources/ y deja lo nuevo en review/queue/.
// Nada se publica solo: la cola se revisa a mano (PR en GitHub).
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { parseRss, checkContract, diffItems, robotsDisallows } from "./lib/rss.mjs";

const ROOT = new URL("..", import.meta.url);
const UA = "RadarCroacia/0.1 (+https://radar.jgcup.stream; proyecto comunitario de la diáspora)";
const sources = JSON.parse(readFileSync(new URL("scripts/sources.json", ROOT)));
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  return { status: res.status, text: await res.text() };
}

const report = [];
let failed = false;
for (const src of sources) {
  try {
    const u = new URL(src.url);
    const robots = await get(`${u.origin}/robots.txt`).catch(() => ({ status: 0, text: "" }));
    if (robots.status === 200 && robotsDisallows(robots.text, u.pathname)) {
      report.push(`⚠️ ${src.name}: robots.txt no permite leerla, se salteó.`);
      continue;
    }
    await sleep(2000);
    const { status, text } = await get(src.url);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const items = parseRss(text).sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
    const problems = checkContract(items, src.min_items);
    if (problems.length) throw new Error("contrato roto: " + problems.join("; "));

    mkdirSync(new URL("data/sources/", ROOT), { recursive: true });
    const file = new URL(`data/sources/${src.id}.json`, ROOT);
    const prev = existsSync(file) ? JSON.parse(readFileSync(file)).items : null;
    writeFileSync(file, JSON.stringify({ source: src.id, name: src.name, url: src.url, items }, null, 1) + "\n");

    if (prev === null) {
      report.push(`🆕 ${src.name}: primera lectura (${items.length} ítems), queda como base.`);
      continue;
    }
    const { added, changed } = diffItems(prev, items);
    if (!added.length && !changed.length) {
      report.push(`✅ ${src.name}: sin novedades (${items.length} ítems).`);
      continue;
    }

    mkdirSync(new URL("review/queue/", ROOT), { recursive: true });
    const q = new URL(`review/queue/${today}_${src.id}.json`, ROOT);
    writeFileSync(
      q,
      JSON.stringify(
        {
          source: src.id,
          name: src.name,
          detected_at: today,
          added,
          changed,
          instrucciones:
            "Revisar a mano. Si aplica a descendientes, crear o actualizar la ficha en site/data/opportunities.json.",
        },
        null,
        1,
      ) + "\n",
    );
    report.push(`🔔 ${src.name}: ${added.length} nuevo(s), ${changed.length} cambiado(s).`);
    for (const it of added) report.push(`   - NUEVO: [${it.title}](${it.link})`);
    for (const it of changed) report.push(`   - CAMBIÓ: [${it.title}](${it.link})`);
  } catch (e) {
    failed = true;
    report.push(`❌ ${src.name}: ${e.message}`);
  }
}

const out = `## Radar: revisión de fuentes (${today})\n\n` + report.join("\n") + "\n";
console.log(out);
writeFileSync(new URL("review/last_run.md", ROOT), out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
process.exit(failed ? 1 : 0);
