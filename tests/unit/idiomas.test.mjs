// Bot de WhatsApp multi-idioma (ZL-78) y «escribí PERSONA» en vez de «por WhatsApp» (ZL-76).
// Datos ficticios: número 5490000000001, phone_number_id 100000000000001.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { _resetCache } from "../../worker/src/index.mjs";
import { applyGuardrails, buildRequest } from "../../worker/src/chat.mjs";
import { memoryChats, panel, textoDevuelta } from "../../worker/src/atencion.mjs";
import {
  CANAL_WHATSAPP,
  canalWhatsApp,
  comando,
  formatAnswer,
  handleEvent,
  memoryStore,
  msgIdiomas,
  parseWebhook,
  sign,
} from "../../worker/src/whatsapp.mjs";
import { BOTON_IDIOMA, IDIOMAS, SALUDO_IDIOMA, SECCION_IDIOMA, TEXTOS_I18N } from "../../worker/src/textos.mjs";

const DB = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));
const FROM = "5490000000001";
const PHONE_ID = "100000000000001";
const respuestaIA = {
  respuesta: "Postoji stipendija za učenje hrvatskog jezika.",
  fichas: [{ id: "beca", t: "Beca de lengua croata", src: ["mdu.gov.hr", "https://mdu.gov.hr/"] }],
  derivar_whatsapp: false,
  fuera_de_tema: false,
  usage: {},
};
const ev = (o) => ({ id: "wamid." + Math.random(), from: FROM, ts: 0, kind: "text", text: "hola", ...o });
const ask = (calls) => async (db, req, opts) => (calls.push({ req, opts }), respuestaIA);

beforeEach(() => _resetCache());

// ── Textos ──

test("textos: los 4 idiomas tienen los mismos textos y respetan los límites de Meta", () => {
  const claves = Object.keys(TEXTOS_I18N.es).sort();
  assert.deepEqual(IDIOMAS, ["es", "hr", "en", "pt"]);
  for (const i of IDIOMAS) {
    const T = TEXTOS_I18N[i];
    assert.deepEqual(Object.keys(T).sort(), claves, i);
    assert.deepEqual(Object.keys(T.perfilListo).sort(), ["ar", "cit", "res"], i);
    assert.equal(T.botones.length, 3, i);
    for (const b of T.botones) assert.ok(b.length <= 20, `${i}: «${b}» pasa de 20`);
    assert.ok(`${T.bienvenida}\n\n${T.aviso}`.length <= 1024, i);
    assert.match(T.aviso, /90/, i);
    assert.match(T.persona, /30/, i);
    for (const [k, v] of Object.entries(T)) {
      if (typeof v === "string") assert.ok(v.trim().length > 0, `${i}.${k} vacío`);
    }
  }
  assert.ok(SALUDO_IDIOMA.length <= 1024);
  assert.ok(BOTON_IDIOMA.length <= 20);
  assert.ok(SECCION_IDIOMA.length <= 24);
  const filas = msgIdiomas(FROM).interactive.action.sections[0].rows;
  assert.deepEqual(
    filas.map((r) => r.id),
    ["idioma_es", "idioma_hr", "idioma_en", "idioma_pt"],
  );
  for (const r of filas) assert.ok(r.title.length <= 24);
});

test("textos: cada idioma nombra comandos que el bot entiende (PERSONA/OSOBA/PERSON/PESSOA, BORRAR/OBRIŠI/…)", () => {
  for (const i of IDIOMAS) {
    const T = TEXTOS_I18N[i];
    const mayus = [...`${T.aviso} ${T.persona} ${T.derivar} ${T.falla}`.matchAll(/\b[A-ZÁÉÍÓÚŠČĆŽĐ]{5,}\b/g)].map(
      (m) => m[0],
    );
    assert.ok(mayus.length >= 2, i);
    for (const w of new Set(mayus)) assert.ok(comando(w), `${i}: «${w}» no es un comando`);
  }
});

test("comando: en los 4 idiomas, sin importar mayúsculas, tildes ni signos", () => {
  const casos = {
    borrar: ["BORRAR", "Obriši", "zaboravi me", "Delete", "forget me!", "APAGAR", "esqueça-me"],
    persona: ["persona", "OSOBA", "razgovor s osobom", "Person", "talk to a person", "pessoa", "atendente"],
    perfil: ["perfil", "profil", "Profile", "mudar perfil"],
    idioma: ["IDIOMA", "jezik", "Language", "língua", "cambiar idioma"],
  };
  for (const [esperado, lista] of Object.entries(casos)) {
    for (const t of lista) assert.equal(comando(t), esperado, t);
  }
  for (const t of ["quiero borrar mi duda", "delete this question please", "osoba iz Rijeke", "idioma croata"]) {
    assert.equal(comando(t), null, t);
  }
});

// ── Entrada ──

test("parseWebhook: la respuesta de la lista de idiomas llega como kind idioma", () => {
  const fx = readFileSync(new URL("../fixtures/whatsapp/lista_idioma.json", import.meta.url), "utf8");
  const [e] = parseWebhook(JSON.parse(fx), PHONE_ID);
  assert.equal(e.kind, "idioma");
  assert.equal(e.idioma, "hr");
  const raro = JSON.parse(fx);
  raro.entry[0].changes[0].value.messages[0].interactive.list_reply.id = "idioma_xx";
  assert.equal(parseWebhook(raro, PHONE_ID)[0].kind, "otro");
});

// ── Flujo ──

test("flujo en croata: lista → hrvatski → botones en croata → perfil → la IA recibe el idioma", async () => {
  const store = memoryStore();
  const calls = [];
  const d = { db: DB, store, ask: ask(calls) };
  const l = await handleEvent(ev({ text: "Bok" }), d);
  assert.equal(l.send[0].interactive.type, "list");
  assert.equal(l.metric, "pide_idioma");

  const b = await handleEvent(ev({ kind: "idioma", idioma: "hr" }), d);
  const it = b.send[0].interactive;
  assert.equal(it.type, "button");
  assert.match(it.body.text, /OSOBA/);
  assert.match(it.body.text, /OBRIŠI/);
  assert.deepEqual(
    it.action.buttons.map((x) => x.reply.id),
    ["perfil_ar", "perfil_cit", "perfil_res"],
  );
  assert.equal(it.action.buttons[2].reply.title, TEXTOS_I18N.hr.botones[2]);

  const p = await handleEvent(ev({ kind: "perfil", perfil: "cit" }), d);
  assert.equal(p.send[0].text.body, TEXTOS_I18N.hr.perfilListo.cit);

  const r = await handleEvent(ev({ text: "Ima li stipendija?" }), d);
  assert.equal(calls[0].opts.idioma, "hr");
  assert.equal(calls[0].req.perfil, "cit");
  assert.match(r.send[0].text.body, /Službeni izvor: https:\/\/mdu\.gov\.hr\//);
  assert.deepEqual(Object.keys(store._data.get(FROM)).sort(), ["humanoHasta", "idioma", "perfil", "visto"]);
});

test("si ignora la lista y escribe igual, sigue en castellano (no queda trabado en la lista)", async () => {
  const store = memoryStore();
  const d = { db: DB, store, ask: ask([]) };
  await handleEvent(ev({ text: "hola" }), d);
  const b = await handleEvent(ev({ text: "¿hay becas?" }), d);
  assert.equal(b.send[0].interactive.type, "button");
  assert.match(b.send[0].interactive.body.text, /PERSONA/);
});

test("quien ya tenía perfil antes del cambio sigue en castellano, sin lista", async () => {
  const store = memoryStore();
  await store.put(FROM, { perfil: "ar", humanoHasta: 0, visto: 1 });
  const calls = [];
  const r = await handleEvent(ev({ text: "¿Hay becas?" }), { db: DB, store, ask: ask(calls) });
  assert.equal(r.metric, "ia");
  assert.equal(calls[0].opts.idioma, "es");
});

test("IDIOMA vuelve a mostrar la lista; con perfil, elegir otro idioma solo confirma", async () => {
  const store = memoryStore();
  await store.put(FROM, { perfil: "res", idioma: "es", humanoHasta: 0, visto: 1 });
  const d = { db: DB, store, ask: ask([]) };
  const l = await handleEvent(ev({ text: "idioma" }), d);
  assert.equal(l.send[0].interactive.type, "list");
  const c = await handleEvent(ev({ kind: "idioma", idioma: "en" }), d);
  assert.equal(c.send[0].text.body, TEXTOS_I18N.en.idiomaCambiado);
  assert.equal(store._data.get(FROM).perfil, "res");
  assert.equal(store._data.get(FROM).idioma, "en");
});

test("BORRAR, PERSONA y audio responden en el idioma de la charla", async () => {
  const store = memoryStore();
  await store.put(FROM, { perfil: "ar", idioma: "pt", humanoHasta: 0, visto: 1 });
  const d = { db: DB, store, ask: ask([]) };
  assert.equal((await handleEvent(ev({ kind: "otro" }), d)).send[0].text.body, TEXTOS_I18N.pt.soloTexto);
  assert.equal((await handleEvent(ev({ text: "pessoa" }), d)).send[0].text.body, TEXTOS_I18N.pt.personaMail);
  assert.equal((await handleEvent(ev({ text: "APAGAR" }), d)).send[0].text.body, TEXTOS_I18N.pt.borrado);
  assert.equal(store._data.size, 0);
});

test("panel: la charla guarda el idioma y «Devolver al bot» avisa en ese idioma", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  const now = 1_792_000_000_000;
  await store.put(FROM, { perfil: "ar", idioma: "hr", humanoHasta: 0, visto: now });
  const p = await handleEvent(ev({ text: "osoba" }), { db: DB, store, ask: ask([]), now, panel: true, chats });
  assert.equal(p.send[0].text.body, TEXTOS_I18N.hr.persona);
  const c = await chats.get(FROM);
  assert.equal(c.idioma, "hr");
  assert.equal((await chats.list())[0].idioma, "hr");
  assert.equal(textoDevuelta("hr"), TEXTOS_I18N.hr.devuelta);
  assert.equal(textoDevuelta("xx"), TEXTOS_I18N.es.devuelta);
  // Sin login el panel no deja hacer nada, aunque exista la charla.
  const r = await panel(new Request("https://atencion.zustrolabs.com/api/charlas"), {}, { chats, store });
  assert.equal(r.status, 503);
});

// ── Prompt y controles ──

test("prompt: en castellano el aviso de canal no cambia; en otro idioma se pide responder en ese idioma", () => {
  assert.equal(canalWhatsApp("es"), CANAL_WHATSAPP);
  assert.equal(canalWhatsApp("xx"), CANAL_WHATSAPP);
  assert.match(canalWhatsApp("hr"), /croata estándar/);
  assert.match(canalWhatsApp("pt"), /portugués/);
  const req = { messages: [{ role: "user", content: "Hi" }], perfil: "ar" };
  assert.ok(buildRequest(DB, req, { canal: canalWhatsApp("en") }).system.includes("inglés"));
});

test("ZL-76: por WhatsApp se saca la oración que dice «por WhatsApp» y se ofrece PERSONA; en la web no", () => {
  const a = {
    respuesta: "No hay becas de arte en el Radar. Si querés, te puede ayudar una persona por WhatsApp.",
    fichas: [],
    derivar_whatsapp: false,
    fuera_de_tema: false,
  };
  const wa = applyGuardrails(a, DB, { whatsapp: true });
  assert.doesNotMatch(wa.respuesta, /whatsapp/i);
  assert.equal(wa.derivar_whatsapp, true);
  assert.match(formatAnswer(wa), /escribí PERSONA/);
  const web = applyGuardrails(a, DB);
  assert.match(web.respuesta, /por WhatsApp/);
});

test("controles por WhatsApp en otro idioma: montos y «sin respuesta» en ese idioma, sin repetir PERSONA", () => {
  const monto = applyGuardrails(
    { respuesta: "Dobiješ 99.999 eura mjesečno.", fichas: ["beca"], derivar_whatsapp: false, fuera_de_tema: false },
    DB,
    { whatsapp: true, idioma: "hr" },
  );
  assert.doesNotMatch(monto.respuesta, /99/);
  assert.match(monto.respuesta, /Za točne iznose/);
  const vacio = applyGuardrails(
    { respuesta: "Pišite nam na WhatsApp.", fichas: [], derivar_whatsapp: true, fuera_de_tema: false },
    DB,
    { whatsapp: true, idioma: "hr" },
  );
  assert.equal(vacio.respuesta, TEXTOS_I18N.hr.sinRespuesta);
  assert.equal(vacio.derivar_whatsapp, false);
  assert.equal(formatAnswer(vacio, "hr").match(/OSOBA/g).length, 1);
});

// ── Worker de punta a punta ──

const env = {
  ANTHROPIC_API_KEY: "k",
  DATA_URL: "https://radar.zustrolabs.com/data/opportunities.json",
  WHATSAPP_APP_SECRET: "secreto-de-prueba",
  WHATSAPP_TOKEN: "token-de-prueba",
  WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
};

test("worker: si Claude falla, el aviso de falla sale en el idioma de la charla", async () => {
  const fx = JSON.parse(readFileSync(new URL("../fixtures/whatsapp/texto.json", import.meta.url), "utf8"));
  const body = JSON.stringify(fx);
  const sent = [];
  const store = memoryStore();
  await store.put(FROM, { perfil: "ar", idioma: "en", humanoHasta: 0, visto: 1 });
  const f = async (url, init) => {
    const u = String(url);
    if (u.endsWith("opportunities.json")) return Response.json(DB);
    if (u.startsWith("https://api.anthropic.com")) return new Response("{}", { status: 400 });
    if (u.startsWith("https://graph.facebook.com")) return sent.push(JSON.parse(init.body)), Response.json({});
    throw new Error("fetch inesperado " + u);
  };
  const req = new Request("https://api.zustrolabs.com/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hub-Signature-256": await sign(body, env.WHATSAPP_APP_SECRET) },
    body,
  });
  const res = await worker.fetch(req, env, {}, { fetch: f, store, now: 1792000000 * 1000 + 60_000 });
  assert.equal(res.status, 200);
  assert.equal(sent[0].text.body, TEXTOS_I18N.en.falla);
});

test("montos: se detectan en los 4 idiomas (€, euros, eura, dollars, kuna, reais) y con separadores de miles", async () => {
  const { moneyIn } = await import("../../worker/src/chat.mjs");
  assert.deepEqual(moneyIn("Dobiješ 99.999 eura"), ["99999"]);
  assert.deepEqual(moneyIn("€1,050 per month"), ["1050"]);
  assert.deepEqual(moneyIn("1 050 €"), ["1050"]);
  assert.deepEqual(moneyIn("20 tisuća eura"), ["20k"]);
  assert.deepEqual(moneyIn("400,50 €"), ["400"]);
  assert.deepEqual(moneyIn("R$ 500 e 5000 kn"), ["500", "5000"]);
  assert.deepEqual(moneyIn("in 2026 you can apply"), []);
});

test("evals: hay casos de WhatsApp en croata, inglés y portugués, y uno de inyección en croata", () => {
  const cases = JSON.parse(readFileSync(new URL("../../evals/chat/cases.json", import.meta.url), "utf8"));
  const wa = cases.filter((c) => c.canal === "whatsapp");
  for (const i of ["hr", "en", "pt"])
    assert.ok(
      wa.some((c) => c.idioma === i),
      i,
    );
  assert.ok(wa.some((c) => /inyecci/i.test(c.porque) && c.idioma === "hr"));
  assert.ok(wa.every((c) => (c.expect.respuesta_no_incluye ?? []).length > 0));
});
