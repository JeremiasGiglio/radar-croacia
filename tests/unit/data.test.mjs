// Reglas de los datos que el esquema no puede expresar. Corren sobre la web y sobre la maqueta offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOfficial, isSpecific } from "../../scripts/lib/official.mjs";

const FILES = ["site/data/opportunities.json", "prototype/data/opportunities.json"];
const load = (f) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"));

for (const f of FILES) {
  test(`${f}: toda ficha con «Revisar» enlaza la fuente oficial concreta (no la portada ni una nota de prensa)`, () => {
    const bad = load(f)
      .opportunities.filter((o) => /\brevisar\b/i.test(JSON.stringify(o)))
      .filter((o) => !(isOfficial(o.src?.[1]) && isSpecific(o.src?.[1])))
      .map((o) => `${o.id} → ${o.src?.[1]}`);
    assert.deepEqual(bad, [], "Verificá el requisito contra el documento oficial (PDF/DOCX) y enlazalo en src.");
  });
}

test("PGŽ Mjera 2.7: el autoempleo cuenta y la fuente es el Javni poziv oficial", () => {
  for (const f of FILES) {
    const o = load(f).opportunities.find((x) => x.id === "pgz");
    assert.equal(o.src[1], "https://www2.pgz.hr/doc/programi/2026/razvoj-poduzetnistva-mjera-21-23-26-27/jp.docx", f);
    assert.doesNotMatch(JSON.stringify(o), /revisar/i, f);
    assert.match(o.flag, /autoempleo cuenta como persona empleada/, f);
    assert.notEqual(o.el.res[0], "ok", `${f}: la edición 2026 no «te sirve» sin obrt`);
    assert.equal(o.deadline, undefined, `${f}: no tiene que mostrar la cuenta regresiva de 2026`);
  }
});

test("isOfficial / isSpecific", () => {
  assert.ok(isOfficial("https://www2.pgz.hr/doc/x.docx"));
  assert.ok(isOfficial("https://mdu.gov.hr/"));
  assert.ok(!isOfficial("https://vijesti.hrt.hr/nota"));
  assert.ok(!isOfficial("http://www.pgz.hr/doc"));
  assert.ok(!isOfficial("https://pgz.hr.example.com/"));
  assert.ok(!isSpecific("https://www.pgz.hr/"));
  assert.ok(isSpecific("https://www.pgz.hr/doc/jp.docx"));
});

test("prototype/index.html (datos embebidos para el evento): PGŽ 2.7 con el mismo dato corregido", () => {
  const html = readFileSync(new URL("../../prototype/index.html", import.meta.url), "utf8");
  const block = html.slice(html.indexOf('{id:"pgz"'), html.indexOf('{id:"rijeka"'));
  assert.ok(block.includes("https://www2.pgz.hr/doc/programi/2026/razvoj-poduzetnistva-mjera-21-23-26-27/jp.docx"));
  assert.match(block, /autoempleo cuenta como persona empleada/);
  assert.doesNotMatch(block, /revisar|deadline:|res:\["ok"/i);
});
