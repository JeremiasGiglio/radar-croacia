// ZL-169: la web armada (_site/) para buscadores: fichas en el HTML, páginas por ficha y por tema, eventos vencidos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  index,
  paginaFicha,
  paginaTema,
  plazo,
  proximos,
  recortar,
  sitemap,
  ultimas,
} from "../../scripts/build-site.mjs";
import { TEMAS, fichasDe, temasDe } from "../../scripts/lib/temas.mjs";

const load = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const db = JSON.parse(load("site/data/opportunities.json"));
const contact = JSON.parse(load("site/data/contact.json"));

test("cada ficha entra en al menos un tema (si no, no tendría hub ni migas)", () => {
  const sueltas = db.opportunities.filter((o) => temasDe(o).length === 0).map((o) => o.id);
  assert.deepEqual(sueltas, []);
});

test("ningún tema queda vacío", () => {
  for (const t of TEMAS) assert.ok(fichasDe(t, db).length > 0, t.slug);
});

test("recortar: nunca pasa de 160 caracteres y corta en una palabra", () => {
  for (const o of db.opportunities) assert.ok(recortar(`${o.t}: ${o.what}`).length <= 160, o.id);
  assert.equal(recortar("corto"), "corto");
  assert.match(recortar("palabra ".repeat(40)), /palabra…$/);
});

test("plazo: abierta, cerrada y sin fecha", () => {
  const hoy = new Date("2026-11-25T12:00:00Z");
  assert.equal(plazo({ deadline: "2026-12-15T23:59:00+01:00" }, hoy).txt, "Cierra el 15/12/2026");
  assert.equal(plazo({ deadline: "2026-11-11T12:00:00+01:00" }, hoy).txt, "Cerró el 11/11/2026");
  assert.equal(plazo({ next: "Todo el año" }, hoy).txt, "Todo el año");
});

test("eventos: los que ya terminaron no se publican (Córdoba 5–8/11)", () => {
  const antes = proximos(db, new Date("2026-11-04T12:00:00Z")).map((e) => e.t);
  const despues = proximos(db, new Date("2026-11-10T12:00:00Z")).map((e) => e.t);
  assert.ok(antes.some((t) => /9\.º Encuentro/.test(t)));
  assert.ok(!despues.some((t) => /9\.º Encuentro/.test(t)));
  assert.equal(proximos({ events: [{ t: "sin fin" }] }, new Date()).length, 1);
});

test("portada armada: sin marcas sin reemplazar, con cada ficha y JSON-LD válido", () => {
  const html = index(load("site/index.html"), db, 12, new Date("2026-11-10T12:00:00Z"));
  assert.doesNotMatch(html, /<!--prerender/);
  for (const o of db.opportunities) assert.ok(html.includes(`href="/f/${o.id}.html"`), o.id);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const tipos = ld["@graph"].map((x) => x["@type"]);
  assert.deepEqual(
    tipos.filter((t) => t !== "Event"),
    ["Organization", "WebSite", "ItemList"],
  );
  assert.ok(!html.includes("9.º Encuentro de la Diáspora Croata Sudamericana</b>"), "Córdoba ya terminó");
});

test("el texto de los datos se escapa en las páginas armadas", () => {
  const o = { ...db.opportunities[0], t: '<img src=x onerror="alert(1)">', what: "</script><script>alert(1)</script>" };
  const html = paginaFicha(o, db, contact);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!/<\/script><script>alert/.test(html));
});

test("página de tema y sitemap", () => {
  const t = TEMAS.find((x) => x.slug === "trabajar");
  const html = paginaTema(t, db);
  assert.match(html, /<h1>Trabajar en Croacia/);
  const xml = sitemap(db);
  assert.equal((xml.match(/<url>/g) || []).length, 1 + TEMAS.length + db.opportunities.length + 2);
});

test("últimas revisiones: las más recientes primero", () => {
  const u = ultimas(db);
  assert.equal(u.length, 5);
  for (let i = 1; i < u.length; i++) assert.ok(u[i - 1].verified_at >= u[i].verified_at);
});
