// Adaptador RSS: XML → ítems normalizados. El contenido es DATO, nunca instrucción.
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: true, cdataPropName: false, trimValues: true, processEntities: true });

/** Limpia HTML, entidades comunes y caracteres invisibles. */
export function cleanText(s) {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @returns {{guid:string,title:string,link:string,published:string|null,summary:string}[]} */
export function parseRss(xml) {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((it) => {
      const link = cleanText(it.link);
      const d = it.pubDate ? new Date(it.pubDate) : null;
      return {
        guid: cleanText(it.guid) || link,
        title: cleanText(it.title),
        link,
        published: d && !isNaN(d) ? d.toISOString() : null,
        summary: cleanText(it.description).slice(0, 1000),
      };
    })
    .filter((it) => it.guid);
}

/** Contrato de una fuente: falla si trae menos ítems de lo esperado o ítems inválidos. */
export function checkContract(items, minItems = 1) {
  const problems = [];
  if (items.length < minItems) problems.push(`trajo ${items.length} ítems (mínimo ${minItems})`);
  for (const it of items) {
    if (!it.title) problems.push(`ítem sin título: ${it.guid}`);
    if (!/^https:\/\//.test(it.link)) problems.push(`link no https: ${it.link}`);
  }
  return problems;
}

/** Compara la versión guardada con la nueva: ítems nuevos y cambiados. */
export function diffItems(prev, next) {
  const before = new Map((prev ?? []).map((i) => [i.guid, i]));
  const added = [],
    changed = [];
  for (const it of next) {
    const old = before.get(it.guid);
    if (!old) added.push(it);
    else if (old.title !== it.title || old.summary !== it.summary || (old.updated ?? null) !== (it.updated ?? null)) {
      changed.push({ ...it, before: { title: old.title, summary: old.summary, updated: old.updated ?? null } });
    }
  }
  return { added, changed };
}

/** robots.txt mínimo: ¿el User-agent * prohíbe esta ruta? */
export function robotsDisallows(robotsTxt, path) {
  let applies = false;
  const rules = [];
  for (const line of String(robotsTxt).split(/\r?\n/)) {
    const [k, ...v] = line.split(":");
    const key = k?.trim().toLowerCase();
    const val = v.join(":").trim();
    if (key === "user-agent") applies = val === "*";
    else if (applies && key === "disallow" && val) rules.push(val);
  }
  return rules.some((r) => path.startsWith(r));
}
