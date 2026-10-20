// Demo sin conexión para eventos (ZL-41): arma prototype/radar-offline.html con la web, los estilos, el código
// y los datos adentro. Se abre con doble clic, sin internet y sin servidor.
// Uso: npm run offline   (el test tests/unit/offline.test.mjs falla si quedó desactualizado)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
// Dentro de <script> no puede aparecer «</script»: se escapa la barra.
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

export function build() {
  const db = JSON.parse(read("site/data/opportunities.json"));
  const contact = JSON.parse(read("site/data/contact.json"));
  // Sin conexión no hay chat con IA; el botón de WhatsApp sigue (abre la app si hay señal).
  delete contact.chat_api;
  const css = read("site/assets/styles.css");
  const js = read("site/assets/app.js");
  const svg = read("site/assets/zustro-simbolo.svg");
  const data = `window.RADAR_OFFLINE=${safeJson({ db, contact, built_at: db.verified_at })};`;

  let html = read("site/index.html");
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`no encontré en index.html: ${from.slice(0, 60)}`);
    html = html.replace(from, () => to);
  };
  // Fuentes de Google: sin internet no cargan; la página usa las del sistema (está probado que no se rompe).
  html = html
    .replace(/<link rel="preconnect"[^>]*>\n?/g, "")
    .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\n?/, "");
  swap('<link rel="stylesheet" href="assets/styles.css">', `<style>\n${css}</style>`);
  swap('<script src="assets/app.js" defer></script>', `<script>${data}</script>\n<script>\n${js}</script>`);
  swap(
    'src="assets/zustro-simbolo.svg"',
    `src="data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}"`,
  );
  // CSP: nada de red; solo los dos scripts de este archivo (por hash) y los estilos de adentro.
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha(data)} ${sha(`\n${js}`)}; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`,
  );
  html = html.replace(/<link rel="canonical"[^>]*>/, "");
  // Aviso visible: es una copia congelada.
  swap(
    '<span class="stamp">Zustro Labs · beta</span>',
    `<span class="stamp">Sin conexión · datos del ${db.verified_at.split("-").reverse().join("/")}</span>`,
  );
  return html;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = new URL("../prototype/radar-offline.html", import.meta.url);
  writeFileSync(out, build());
  console.log("Listo: prototype/radar-offline.html");
}
