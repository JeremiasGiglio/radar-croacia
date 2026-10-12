import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRss, checkContract, diffItems, robotsDisallows, cleanText } from "../../scripts/lib/rss.mjs";

const fx = name => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

test("Oficina (RSS 574): parsea las 20 entradas de la copia guardada", () => {
  const items = parseRss(fx("oficina_574.xml"));
  assert.equal(items.length, 20);
  for (const it of items) {
    assert.match(it.link, /^https:\/\/hrvatiizvanrh\.gov\.hr\//);
    assert.ok(it.title.length > 5);
    assert.ok(it.published, "tiene fecha");
    assert.doesNotMatch(it.summary, /<|&nbsp;|​/);
  }
});

test("MDU (RSS 5923): parsea una sola entrada como lista", () => {
  const items = parseRss(fx("mdu_5923.xml"));
  assert.equal(items.length, 1);
  assert.match(items[0].link, /\/7595$/);
  assert.equal(items[0].summary, "");
});

test("contrato: un feed vacío rompe el contrato", () => {
  const empty = '<?xml version="1.0"?><rss version="2.0"><channel><title>RSS</title></channel></rss>';
  assert.deepEqual(parseRss(empty), []);
  assert.match(checkContract([], 1).join(), /trajo 0 ítems/);
});

test("contrato: rechaza links que no son https", () => {
  const p = checkContract([{ guid: "x", title: "Algo", link: "http://inseguro" }], 1);
  assert.match(p.join(), /no https/);
});

test("diff: detecta ítems nuevos y cambiados, ignora los iguales", () => {
  const a = { guid: "1", title: "Uno", summary: "s" }, b = { guid: "2", title: "Dos", summary: "s" };
  const { added, changed } = diffItems([a, b], [a, { ...b, title: "Dos (plazo extendido)" }, { guid: "3", title: "Tres", summary: "" }]);
  assert.deepEqual(added.map(i => i.guid), ["3"]);
  assert.equal(changed[0].before.title, "Dos");
});

test("robots.txt: respeta Disallow para User-agent *", () => {
  const r = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /privado";
  assert.equal(robotsDisallows(r, "/rss.aspx"), false);
  assert.equal(robotsDisallows(r, "/privado/x"), true);
});

test("el texto de la fuente se limpia de HTML (es dato, no instrucción)", () => {
  assert.equal(cleanText('<script>alert(1)</script>Hola&nbsp;mundo'), "alert(1) Hola mundo");
});
