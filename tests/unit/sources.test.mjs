import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRss, checkContract, diffItems } from "../../scripts/lib/rss.mjs";
import { parseWp } from "../../scripts/lib/wp.mjs";

const fx = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const sources = JSON.parse(readFileSync(new URL("../../scripts/sources.json", import.meta.url), "utf8"));
const src = (id) => sources.find((s) => s.id === id);

/** Contrato común: cantidad mínima, links https del dominio correcto, sin HTML ni entidades sueltas. */
function assertSource(items, id, domain) {
  const s = src(id);
  assert.ok(s, `la fuente ${id} está registrada`);
  assert.deepEqual(checkContract(items, s.min_items), []);
  for (const it of items) {
    assert.match(it.link, new RegExp(`^https://${domain.replace(/\./g, "\\.")}/`));
    assert.ok(it.published, `tiene fecha: ${it.title}`);
    assert.doesNotMatch(it.title + it.summary, /<[a-z/]|&#\d+;|&nbsp;/i);
  }
}

test("PGŽ (feed de Projekti i programi): 10 convocatorias de la copia guardada", () => {
  const items = parseRss(fx("pgz_projekt_program.xml"));
  assert.equal(items.length, 10);
  assertSource(items, "pgz_javni_pozivi", "www.pgz.hr");
  assert.ok(items.some((i) => /javni poziv/i.test(i.title)));
});

test("Ured za udruge (RSS 8): 20 novedades con fecha", () => {
  const items = parseRss(fx("udruge_8.xml"));
  assert.equal(items.length, 20);
  assertSource(items, "udruge_vijesti", "udruge.gov.hr");
});

test("Grad Rijeka (API de WordPress): solo quedan los títulos de convocatorias", () => {
  const raw = JSON.parse(fx("rijeka_javni_poziv.json"));
  const items = parseWp(fx("rijeka_javni_poziv.json"), src("rijeka_javni_pozivi"));
  assert.equal(raw.length, 30);
  assert.equal(items.length, 5);
  assertSource(items, "rijeka_javni_pozivi", "www.rijeka.hr");
  for (const it of items) assert.match(it.title, /javni poziv|natje[čc]aj|potpor|stipendij|subvencij/i);
  assert.ok(items.every((i) => i.guid.startsWith("wp:")));
});

test("HZZ (páginas de medidas): 22 medidas con fecha de actualización", () => {
  const items = parseWp(fx("hzz_korisnicki_centar.json"), src("hzz_mjere"));
  assert.equal(items.length, 22);
  assertSource(items, "hzz_mjere", "mjere.hzz.hr");
  const auto = items.find((i) => i.title === "Potpora za samozapošljavanje");
  assert.ok(auto, "está la ayuda para autoempleo");
  assert.equal(auto.updated, "2026-04-10T13:44:12.000Z");
});

test("HZZ: si cambia solo la fecha de actualización, cuenta como cambio", () => {
  const before = parseWp(fx("hzz_korisnicki_centar.json"));
  const after = before.map((i) => (i.guid === "wp:64" ? { ...i, updated: "2026-11-01T08:00:00.000Z" } : i));
  const { added, changed } = diffItems(before, after);
  assert.equal(added.length, 0);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].before.updated, "2026-04-10T13:44:12.000Z");
});

test("WordPress: una lista vacía rompe el contrato y una respuesta que no es lista falla", () => {
  assert.match(checkContract(parseWp("[]"), src("hzz_mjere").min_items).join(), /trajo 0 ítems/);
  assert.throws(() => parseWp('{"code":"rest_no_route"}'), /no devolvió una lista/);
});

test("todas las fuentes tienen id, nombre con el original en croata, tipo conocido y URL https", () => {
  const ids = new Set();
  for (const s of sources) {
    assert.match(s.id, /^[a-z0-9_]+$/);
    assert.ok(!ids.has(s.id), `id repetido: ${s.id}`);
    ids.add(s.id);
    assert.match(s.name, /\(.+\)/, `nombre croata entre paréntesis: ${s.name}`);
    assert.ok(["rss", "wp"].includes(s.type), `tipo: ${s.type}`);
    assert.match(s.url, /^https:\/\//);
    assert.ok(s.min_items >= 1);
  }
  assert.ok(sources.length >= 6);
});
