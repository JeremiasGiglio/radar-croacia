// Genera los íconos y la imagen para compartir del Radar (ZL-169): favicon.svg, favicon.ico, apple-touch-icon.png y
// assets/og.png (1200×630). El damero arranca SIEMPRE en rojo (la casilla de arriba a la izquierda): lo controla
// tests/marca.spec.ts. Uso: node scripts/marca.mjs (necesita Playwright; los archivos quedan en site/ y se suben).
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROJO = "#C8102E";
const site = (p) => new URL(`../site/${p}`, import.meta.url);

/** Damero de n×n: las casillas pares (empezando por la de arriba a la izquierda) son rojas. */
export function damero(n = 5, lado = 50, { borde = true } = {}) {
  const c = lado / n;
  let rects = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if ((x + y) % 2 === 0) rects += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}" fill="${ROJO}"/>`;
  const marco = borde
    ? `<rect x="0.75" y="0.75" width="${lado - 1.5}" height="${lado - 1.5}" fill="none" stroke="${ROJO}" stroke-width="1.5"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}"><rect width="${lado}" height="${lado}" fill="#ffffff"/>${rects}${marco}</svg>`;
}

const OG = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@500&display=swap">
<style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f3f6f7;font-family:"Source Sans 3",sans-serif;color:#13212e;position:relative;overflow:hidden}
.d{position:absolute;left:90px;top:185px;width:260px;height:260px}
.t{position:absolute;left:410px;top:150px;right:70px}
h1{font:700 118px/0.95 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.01em}
p{font-size:38px;line-height:1.2;margin-top:18px}
.m{font-size:27px;color:#5b6b78;margin-top:22px}
.u{position:absolute;left:90px;bottom:52px;font:500 26px "JetBrains Mono",monospace;color:${ROJO}}
.z{position:absolute;right:70px;bottom:50px;font-size:26px;color:#5b6b78;display:flex;gap:10px;align-items:center}
.z b{color:#13212e}
.bar{position:absolute;left:0;top:0;height:14px;width:100%;background:#1d5f8a}
</style></head><body>
<div class="bar"></div>
<div class="d">${damero(5, 260)}</div>
<div class="t"><h1>Radar Croacia</h1><p>Programas, becas y oportunidades en Croacia, en español</p>
<p class="m">Fichas con fuente oficial · según tu situación · gratis</p></div>
<div class="u">radar.zustrolabs.com</div>
<div class="z">un proyecto de <b>Zustro Labs</b></div>
</body></html>`;

/** .ico con una imagen PNG adentro (lo aceptan todos los navegadores actuales). */
function ico(png, lado) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0);
  h.writeUInt16LE(1, 2);
  h.writeUInt16LE(1, 4);
  h.writeUInt8(lado, 6);
  h.writeUInt8(lado, 7);
  h.writeUInt16LE(1, 10);
  h.writeUInt16LE(32, 12);
  h.writeUInt32LE(png.length, 14);
  h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

async function main() {
  const { chromium } = await import("playwright");
  writeFileSync(site("favicon.svg"), damero(5, 50) + "\n");
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const png = async (svg, lado) => {
    await page.setViewportSize({ width: lado, height: lado });
    await page.setContent(`<style>*{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`);
    return page.screenshot({ type: "png" });
  };
  writeFileSync(site("favicon.ico"), ico(await png(damero(5, 50, { borde: false }), 32), 32));
  // Ícono de iPhone: con margen blanco para que el damero no quede cortado por las esquinas redondeadas.
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(
    `<style>*{margin:0}body{width:180px;height:180px;background:#fff;display:grid;place-items:center}svg{width:140px;height:140px}</style>${damero(5, 50)}`,
  );
  writeFileSync(site("apple-touch-icon.png"), await page.screenshot({ type: "png" }));
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(OG, { waitUntil: "networkidle" });
  await page.evaluate(() => globalThis.document.fonts.ready);
  writeFileSync(site("assets/og.png"), await page.screenshot({ type: "png" }));
  await browser.close();
  console.log("Listo: favicon.svg, favicon.ico, apple-touch-icon.png y assets/og.png");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
