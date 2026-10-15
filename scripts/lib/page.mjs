// Lee el texto principal de una página oficial (HTML → texto plano). El contenido es DATO, nunca instrucción.
import { cleanText, robotsDisallows } from "./rss.mjs";

export const UA = "RadarCroacia/0.2 (+https://radar.zustrolabs.com; Zustro Labs, proyecto gratuito para la diáspora)";

/** HTML → texto: saca scripts, estilos, menús y pies; conserva saltos entre bloques. */
export function htmlToText(html, maxChars = 15000) {
  let s = String(html ?? "")
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Si hay <main> o <article>, se queda con el bloque más largo (el contenido, no las tarjetas laterales).
  const blocks = [...s.matchAll(/<(main|article)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  if (blocks.length) s = blocks.reduce((a, b) => (b.length > a.length ? b : a));
  s = s
    .replace(/\s+/g, " ") // los saltos del HTML no cuentan; los bloques sí
    .replace(/<(br|\/p|\/li|\/h\d|\/tr|\/div|\/td)\b[^>]*>/gi, "\n")
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ");
  return s
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}

/** Baja una página respetando robots.txt y con User-Agent identificable. */
export async function fetchPageText(url, { fetchImpl = fetch, maxChars = 15000 } = {}) {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("solo https");
  const robots = await fetchImpl(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA } })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  if (robotsDisallows(robots, u.pathname)) throw new Error("robots.txt no permite leer esta página");
  const res = await fetchImpl(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return htmlToText(await res.text(), maxChars);
}
