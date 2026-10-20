// Demo sin conexión para eventos (ZL-41): prototype/radar-offline.html tiene que estar al día con la web.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "../../scripts/build-offline.mjs";

const file = readFileSync(new URL("../../prototype/radar-offline.html", import.meta.url), "utf8");
const db = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));

test("la demo offline está al día con la web y los datos (si falla: npm run offline)", () => {
  assert.equal(file, build(), "corré: npm run offline");
});

test("la demo offline no pide nada a la red: sin scripts, estilos ni imágenes de afuera, CSP sin red", () => {
  assert.doesNotMatch(file, /<script[^>]+src=/);
  assert.doesNotMatch(file, /<link[^>]+stylesheet/);
  assert.doesNotMatch(file, /<img[^>]+src="https?:/);
  assert.match(file, /default-src 'none'/);
  assert.doesNotMatch(file, /connect-src/);
  assert.doesNotMatch(file, /"chat_api":/); // sin conexión no hay chat con IA
  assert.match(file, /Sin conexión · datos del \d{2}\/\d{2}\/\d{4}/);
});

test("la demo offline trae todas las fichas", () => {
  for (const o of db.opportunities) assert.ok(file.includes(`"id":"${o.id}"`), o.id);
});
