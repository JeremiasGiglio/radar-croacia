// Adaptador WordPress (API REST /wp-json/wp/v2/...): JSON → ítems normalizados, igual que parseRss.
// Sirve para webs sin feed útil (Grad Rijeka, HZZ). El contenido es DATO, nunca instrucción.
import { cleanText } from "./rss.mjs";

const iso = (s) => {
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); // WordPress manda *_gmt sin zona
  return isNaN(d) ? null : d.toISOString();
};

/**
 * @param {string} text respuesta JSON de /wp-json/wp/v2/<tipo>
 * @param {{title_filter?: string}} [opts] title_filter: regex (sin distinguir mayúsculas) que tiene que cumplir el título
 * @returns {{guid:string,title:string,link:string,published:string|null,updated:string|null,summary:string}[]}
 */
export function parseWp(text, opts = {}) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("la API de WordPress no devolvió una lista");
  const keep = opts.title_filter ? new RegExp(opts.title_filter, "iu") : null;
  return data
    .map((p) => {
      const link = cleanText(p.link);
      return {
        guid: p.id != null ? `wp:${p.id}` : link,
        title: cleanText(p.title?.rendered),
        link,
        published: iso(p.date_gmt ?? p.date),
        updated: iso(p.modified_gmt ?? p.modified),
        summary: cleanText(p.excerpt?.rendered).slice(0, 1000),
      };
    })
    .filter((it) => it.guid && (!keep || keep.test(it.title)));
}
