// Arma la web publicable en _site/ (ZL-169): copia site/ y genera lo que los buscadores necesitan ver sin JavaScript.
// - index.html con las fichas, los eventos y las últimas revisiones ya escritos en el HTML, y JSON-LD.
// - Una página por ficha (/f/<id>.html) y una por tema (/becas/, /estudiar/, …).
// - sitemap.xml y 404.html.
// Uso: npm run build   (los tests E2E y la publicación usan _site/). Solo usa módulos de Node: corre sin npm ci.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { TEMAS, fichasDe, temasDe } from "./lib/temas.mjs";

export const SITE = "https://radar.zustrolabs.com";
const ROOT = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const safeUrl = (u) => (/^https:\/\//.test(u || "") ? esc(u) : "#");
// Dentro de <script type="application/ld+json"> no puede aparecer «</script».
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const fecha = (iso) =>
  String(iso || "")
    .slice(0, 10)
    .split("-")
    .reverse()
    .join("/");
/** Recorta en una palabra y agrega «…» para que la descripción no pase de n caracteres. */
export function recortar(s, n = 155) {
  s = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= n) return s;
  const corte = s.slice(0, n - 1);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:.]$/, "") + "…";
}

const CSP =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.zustrolabs.com https://cloudflareinsights.com; base-uri 'none'; form-action 'none'";
const BEACON =
  '<!-- Cloudflare Web Analytics (ZL-129): cuenta visitas sin cookies ni datos personales --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "c8b1f991a80a462395ecc8dd99f2aad3"}\'></script>';
const CHECKER = `<span class="checker" aria-hidden="true">${"<i></i>".repeat(25)}</span>`;

export const ORG = {
  "@type": "Organization",
  "@id": "https://zustrolabs.com/#org",
  name: "Zustro Labs",
  url: "https://zustrolabs.com/",
  logo: `${SITE}/assets/zustro-simbolo.svg`,
  email: "contact@zustrolabs.com",
};

function cabeza({ titulo, descripcion, ruta, jsonld = [] }) {
  const url = SITE + ruta;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#C8102E" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1B2230" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Radar Croacia"><meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descripcion)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Radar Croacia: programas, becas y oportunidades en Croacia, en español">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/assets/styles.css">
${jsonld.map(ld).join("\n")}
</head><body class="pagina">
<a class="skip" href="#contenido">Ir al contenido</a>
<div class="wrap">
<header class="mini"><a class="brand" href="/">${CHECKER}<span class="brand-t">Radar Croacia</span></a><a class="head-link" href="/?chat=1">Preguntale al Radar</a></header>
<main id="contenido" class="contenido">`;
}

function pie(db) {
  return `</main>
<nav class="temas" aria-label="Temas">${TEMAS.map((t) => `<a href="/${t.slug}/">${esc(t.nombre)}</a>`).join("")}</nav>
<footer><span>${esc(db.note)} Última revisión: ${fecha(db.verified_at)}.</span>
<span class="made-by"><img src="/assets/zustro-simbolo.svg" alt="" width="16" height="16"> Radar Croacia es un proyecto de <strong>Zustro Labs</strong>, estudio de software e inteligencia artificial. Es gratis y de código abierto: <a href="https://github.com/JeremiasGiglio/radar-croacia">GitHub</a>. Es información, no asesoramiento legal. <a href="/privacidad.html">Privacidad</a>.</span></footer>
</div>
${BEACON}
</body></html>
`;
}

/** Estado del plazo calculado el día del build (la publicación corre todos los días). */
export function plazo(o, hoy = new Date()) {
  if (o.deadline) {
    const cerrada = new Date(o.deadline) < hoy;
    return cerrada
      ? { cls: "p-next", txt: `Cerró el ${fecha(o.deadline)}`, cerrada }
      : { cls: "p-open", txt: `Cierra el ${fecha(o.deadline)}`, cerrada };
  }
  return { cls: "p-next", txt: o.next || "Sin fecha de cierre", cerrada: false };
}

function tarjeta(o, db, hoy) {
  const c = db.categories[o.cat];
  const st = plazo(o, hoy);
  return `<li class="card pre"><div class="top"><span class="cat"><b style="background:${esc(c.c)}"></b>${esc(c.n)}</span><span class="pill ${st.cls}">${esc(st.txt)}</span>${o.abierta ? '<span class="pill p-abierta">Abierta a todos</span>' : ""}</div><h3><a href="/f/${esc(o.id)}.html">${esc(o.t)}</a></h3><p class="who">${esc(o.who)}</p></li>`;
}

const EL = { ok: ["p-ok", "Sirve"], cond: ["p-warn", "Con condiciones"], no: ["p-no", "No aplica"] };

function waHref(contact, text) {
  const n = String(contact.whatsapp || "").replace(/\D/g, "");
  return n.length >= 8 ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "";
}

export function paginaFicha(o, db, contact, hoy = new Date()) {
  const c = db.categories[o.cat];
  const st = plazo(o, hoy);
  const temas = temasDe(o);
  const tema = temas[0];
  const ruta = `/f/${o.id}.html`;
  const descripcion = recortar(`${o.t}: ${o.what}`);
  const migas = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Radar Croacia", item: `${SITE}/` },
      ...(tema ? [{ "@type": "ListItem", position: 2, name: tema.nombre, item: `${SITE}/${tema.slug}/` }] : []),
      { "@type": "ListItem", position: tema ? 3 : 2, name: o.t, item: SITE + ruta },
    ],
  };
  const pagina = {
    "@type": "WebPage",
    name: o.t,
    description: descripcion,
    url: SITE + ruta,
    inLanguage: "es",
    dateModified: o.verified_at || db.verified_at,
    isPartOf: { "@id": `${SITE}/#web` },
    publisher: { "@id": ORG["@id"] },
  };
  const wa = waHref(contact, `Hola, vengo del Radar Croacia. Quiero consultar sobre: «${o.t}». (ficha ${o.id})`);
  const otras = tema ? fichasDe(tema, db).filter((x) => x.id !== o.id) : [];
  return (
    cabeza({
      titulo: `${o.t} · Radar Croacia`,
      descripcion,
      ruta,
      jsonld: [{ "@context": "https://schema.org", "@graph": [pagina, migas] }],
    }) +
    `<nav class="migas" aria-label="Estás en"><a href="/">Radar Croacia</a>${tema ? ` › <a href="/${tema.slug}/">${esc(tema.nombre)}</a>` : ""}</nav>
<article class="ficha" id="ficha-${esc(o.id)}">
<div class="top"><span class="cat"><b style="background:${esc(c.c)}"></b>${esc(c.n)}</span><span class="pill ${st.cls}">${esc(st.txt)}</span>${o.abierta ? '<span class="pill p-abierta">Abierta a todos</span>' : ""}</div>
<h1>${esc(o.t)}</h1>
${o.t_hr ? `<p class="who" lang="hr">${esc(o.t_hr)}</p>` : ""}
<p class="who">${esc(o.who)}</p>
<p>${esc(o.what)}</p>
<dl class="facts"><div><dt>Monto</dt><dd>${esc(o.amount || "No figura en la fuente")}</dd></div>${st.cerrada && o.next ? `<div><dt>Próxima</dt><dd>${esc(o.next)}</dd></div>` : ""}</dl>
${o.flag ? `<p class="flag">${esc(o.flag)}</p>` : ""}
<h2>¿A quién le sirve?</h2>
<ul class="el3">${Object.keys(db.profiles)
      .map(
        (p) =>
          `<li><span class="pill ${EL[o.el[p][0]][0]}">${EL[o.el[p][0]][1]}</span><span><b>${esc(db.profiles[p])}.</b> ${esc(o.el[p][1])}</span></li>`,
      )
      .join("")}</ul>
<div class="src"><span class="src-tipo src-${esc(o.fuente || "oficial")}">${esc((db.fuentes || {})[o.fuente] || "Fuente oficial")}: <a href="${safeUrl(o.src[1])}" target="_blank" rel="noopener">${esc(o.src[0])}</a></span><span>Revisado ${fecha(o.verified_at || db.verified_at)}</span></div>
<div class="acciones"><a class="btn" href="/?f=${esc(o.id)}">Ver en el mapa</a><a class="btn" href="/?chat=1">Preguntale al Radar</a>${wa ? `<a class="wa" href="${esc(wa)}" target="_blank" rel="noopener">Consultar por WhatsApp</a>` : ""}</div>
<p class="note">La fuente oficial manda: los montos y plazos pueden cambiar. Es información, no asesoramiento legal.</p>
</article>
${
  otras.length
    ? `<section class="panel"><h2>Más de ${esc(tema.nombre.toLowerCase())}</h2><ul class="pre-list">${otras
        .slice(0, 6)
        .map((x) => tarjeta(x, db, hoy))
        .join("")}</ul><p><a href="/${tema.slug}/">Ver todas las de ${esc(tema.nombre.toLowerCase())}</a></p></section>`
    : ""
}` +
    pie(db)
  );
}

export function paginaTema(tema, db, hoy = new Date()) {
  const lista = fichasDe(tema, db);
  const ruta = `/${tema.slug}/`;
  const descripcion = recortar(`${tema.intro} ${lista.length} fichas revisadas, en español.`);
  const itemList = {
    "@type": "ItemList",
    name: tema.titulo,
    numberOfItems: lista.length,
    itemListElement: lista.map((o, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/f/${o.id}.html`,
      name: o.t,
    })),
  };
  return (
    cabeza({
      titulo: `${tema.titulo} · Radar Croacia`,
      descripcion,
      ruta,
      jsonld: [{ "@context": "https://schema.org", "@graph": [itemList] }],
    }) +
    `<nav class="migas" aria-label="Estás en"><a href="/">Radar Croacia</a></nav>
<h1>${esc(tema.titulo)}</h1>
<p class="sub">${esc(tema.intro)}</p>
<p class="count">${lista.length} fichas · <a href="/">Filtrarlas según tu situación</a></p>
<ul class="pre-list">${lista.map((o) => tarjeta(o, db, hoy)).join("")}</ul>` +
    pie(db)
  );
}

/** Eventos que todavía no terminaron (los que no tienen fecha de fin se muestran siempre). */
export const proximos = (db, hoy = new Date()) => {
  const d = hoy.toISOString().slice(0, 10);
  return (db.events || []).filter((e) => !e.end || e.end >= d);
};

export const ultimas = (db, n = 5) =>
  [...db.opportunities]
    .sort((a, b) => String(b.verified_at || "").localeCompare(String(a.verified_at || "")))
    .slice(0, n);

function eventoLd(e) {
  const virtual = /online|virtual/i.test(e.where);
  const hibrido = /h[ií]brido/i.test(e.where);
  return {
    "@type": "Event",
    name: e.t,
    startDate: e.start,
    endDate: e.end || e.start,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${hibrido ? "Mixed" : virtual ? "Online" : "Offline"}EventAttendanceMode`,
    location: virtual ? { "@type": "VirtualLocation", url: e.src[1] } : { "@type": "Place", name: e.where },
    url: e.src[1],
    description: e.note,
  };
}

export function index(html, db, sources, hoy = new Date()) {
  const swap = (marca, contenido) => {
    if (!html.includes(marca)) throw new Error(`no encontré ${marca} en site/index.html`);
    html = html.replace(marca, () => contenido);
  };
  const eventos = proximos(db, hoy);
  const grafo = [
    ORG,
    {
      "@type": "WebSite",
      "@id": `${SITE}/#web`,
      name: "Radar Croacia",
      url: `${SITE}/`,
      inLanguage: "es",
      description:
        "Programas, becas y oportunidades en Croacia en español, con fuentes oficiales y filtradas según tu situación.",
      publisher: { "@id": ORG["@id"] },
    },
    {
      "@type": "ItemList",
      name: "Programas, becas y oportunidades en Croacia",
      numberOfItems: db.opportunities.length,
      itemListElement: db.opportunities.map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/f/${o.id}.html`,
        name: o.t,
      })),
    },
    ...eventos.filter((e) => e.start).map(eventoLd),
  ];
  swap("</head>", `${ld({ "@context": "https://schema.org", "@graph": grafo })}\n</head>`);
  swap(
    "<!--prerender:intro-->",
    `${db.opportunities.length} fichas revisadas a mano, de ${sources} fuentes oficiales que se vigilan todos los días.`,
  );
  swap(
    "<!--prerender:lista-->",
    `<ul class="pre-list">${db.opportunities.map((o) => tarjeta(o, db, hoy)).join("")}</ul>`,
  );
  swap(
    "<!--prerender:eventos-->",
    eventos
      .map(
        (e) =>
          `<li><time>${esc(e.date)}</time><span class="t"><b>${esc(e.t)}</b>, ${esc(e.where)}. ${esc(e.note)} <a href="${safeUrl(e.src[1])}" target="_blank" rel="noopener">${esc(e.src[0])}</a></span></li>`,
      )
      .join(""),
  );
  swap(
    "<!--prerender:ultimas-->",
    ultimas(db)
      .map(
        (o) =>
          `<li><time>${fecha(o.verified_at)}</time><span class="t"><a href="/f/${esc(o.id)}.html">${esc(o.t)}</a></span></li>`,
      )
      .join(""),
  );
  return html;
}

export function sitemap(db) {
  const u = (loc, lastmod) => `<url><loc>${SITE}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  u("/", db.verified_at),
  ...TEMAS.map((t) => u(`/${t.slug}/`, db.verified_at)),
  ...db.opportunities.map((o) => u(`/f/${o.id}.html`, o.verified_at || db.verified_at)),
  u("/asistente.html"),
  u("/privacidad.html"),
].join("\n")}
</urlset>
`;
}

function pagina404(db) {
  return (
    cabeza({
      titulo: "No encontramos esa página · Radar Croacia",
      descripcion: "La página no existe o cambió de dirección.",
      ruta: "/404.html",
    }).replace(
      '<link rel="canonical" href="https://radar.zustrolabs.com/404.html">',
      '<meta name="robots" content="noindex">',
    ) +
    `<h1>No encontramos esa página</h1><p>Puede que la ficha haya cambiado de dirección. <a href="/">Volver al Radar</a> o buscá por tema:</p>` +
    pie(db)
  );
}

export function build(out = new URL("_site/", ROOT), hoy = new Date()) {
  const db = JSON.parse(read("site/data/opportunities.json"));
  const contact = JSON.parse(read("site/data/contact.json"));
  const sources = JSON.parse(read("scripts/sources.json")).length;
  rmSync(out, { recursive: true, force: true });
  cpSync(new URL("site/", ROOT), out, { recursive: true });
  const w = (p, s) => {
    const f = new URL(p, out);
    mkdirSync(new URL(".", f), { recursive: true });
    writeFileSync(f, s);
  };
  w("index.html", index(read("site/index.html"), db, sources, hoy));
  for (const o of db.opportunities) w(`f/${o.id}.html`, paginaFicha(o, db, contact, hoy));
  for (const t of TEMAS) w(`${t.slug}/index.html`, paginaTema(t, db, hoy));
  w("sitemap.xml", sitemap(db));
  w("404.html", pagina404(db));
  return { fichas: db.opportunities.length, temas: TEMAS.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const r = build();
  console.log(`Listo: _site/ con ${r.fichas} fichas y ${r.temas} temas`);
}
