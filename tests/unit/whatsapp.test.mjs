import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { _resetCache } from "../../worker/src/index.mjs";
import {
  BOTONES_PERFIL,
  CANAL_WHATSAPP,
  comando,
  formatAnswer,
  handleEvent,
  memoryStore,
  parseWebhook,
  sign,
  TEXTOS,
  verifySignature,
  verifySubscription,
} from "../../worker/src/whatsapp.mjs";
import { buildRequest } from "../../worker/src/chat.mjs";

const DB = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));
const fx = (n) => readFileSync(new URL(`../fixtures/whatsapp/${n}.json`, import.meta.url), "utf8");
const PHONE_ID = "100000000000001";
const FROM = "5490000000001";
const NOW = 1792000000 * 1000 + 60_000; // un minuto después del mensaje de ejemplo
const env = {
  ANTHROPIC_API_KEY: "k",
  DATA_URL: "https://radar.zustrolabs.com/data/opportunities.json",
  WHATSAPP_APP_SECRET: "secreto-de-prueba",
  WHATSAPP_TOKEN: "token-de-prueba",
  WHATSAPP_VERIFY_TOKEN: "verificar-de-prueba",
  WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
};
const respuestaIA = {
  respuesta: "Te sirve la beca de lengua croata del ministerio.",
  fichas: [{ id: "beca", t: "Beca de lengua croata", src: ["mzom.gov.hr", "https://mzom.gov.hr/beca"] }],
  derivar_whatsapp: false,
  fuera_de_tema: false,
  usage: {},
};

/** fetch simulado: fichas, API de Claude y Graph API (guarda lo que se manda). */
function fakeFetch(sent, model = { ...respuestaIA, fichas: ["beca"] }) {
  return async (url, init) => {
    const u = String(url);
    if (u.endsWith("opportunities.json")) return Response.json(DB);
    if (u.startsWith("https://api.anthropic.com")) {
      sent.claude = JSON.parse(init.body);
      return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(model) }] });
    }
    if (u.startsWith("https://graph.facebook.com")) {
      sent.push({ url: u, auth: init.headers.authorization, body: JSON.parse(init.body) });
      return Response.json({ messages: [{ id: "wamid.OUT" }] });
    }
    throw new Error("fetch inesperado " + u);
  };
}
async function post(body, { secret = env.WHATSAPP_APP_SECRET, signature } = {}) {
  const sig = signature ?? (await sign(body, secret));
  return new Request("https://api.zustrolabs.com/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hub-Signature-256": sig },
    body,
  });
}

beforeEach(() => _resetCache());

// ── Verificación y firma ──

test("whatsapp: la verificación de Meta devuelve el challenge solo con el token correcto", () => {
  const u = (t) =>
    new URL(`https://api.zustrolabs.com/whatsapp?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=12345`);
  assert.deepEqual(verifySubscription(u("verificar-de-prueba"), env), { status: 200, body: "12345" });
  assert.equal(verifySubscription(u("otro"), env).status, 403);
  assert.equal(verifySubscription(u("x"), {}).status, 503);
});

test("whatsapp: la firma HMAC se valida y rechaza cuerpos cambiados o firmas mal formadas", async () => {
  const body = fx("texto");
  const s = await sign(body, "abc");
  assert.match(s, /^sha256=[0-9a-f]{64}$/);
  assert.ok(await verifySignature(body, s, "abc"));
  assert.ok(!(await verifySignature(body + " ", s, "abc")));
  assert.ok(!(await verifySignature(body, s, "otro")));
  assert.ok(!(await verifySignature(body, "sha1=abc", "abc")));
  assert.ok(!(await verifySignature(body, null, "abc")));
  assert.ok(!(await verifySignature(body, s, "")));
});

test("worker /whatsapp: sin firma válida → 401 y no se llama a nadie", async () => {
  const sent = [];
  const res = await worker.fetch(await post(fx("texto"), { secret: "falso" }), env, {}, { fetch: fakeFetch(sent) });
  assert.equal(res.status, 401);
  assert.equal(sent.length, 0);
  assert.equal(sent.claude, undefined);
});

test("worker /whatsapp: sin secretos cargados → 503 (nunca procesa sin firma)", async () => {
  const res = await worker.fetch(await post(fx("texto")), { ...env, WHATSAPP_APP_SECRET: "" }, {}, {});
  assert.equal(res.status, 503);
});

test("worker /whatsapp: GET de verificación por el Worker", async () => {
  const res = await worker.fetch(
    new Request(
      "https://api.zustrolabs.com/whatsapp?hub.mode=subscribe&hub.verify_token=verificar-de-prueba&hub.challenge=987",
    ),
    env,
    {},
    {},
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "987");
});

// ── Entrada ──

test("parseWebhook: texto, botón de perfil, audio; ignora estados y otros números", () => {
  assert.deepEqual(parseWebhook(JSON.parse(fx("texto")), PHONE_ID), [
    { id: "wamid.TEST_TEXTO_1", from: FROM, ts: 1792000000, kind: "text", text: "¿Hay becas para estudiar croata?" },
  ]);
  assert.equal(parseWebhook(JSON.parse(fx("boton_perfil")), PHONE_ID)[0].perfil, "res");
  assert.equal(parseWebhook(JSON.parse(fx("audio")), PHONE_ID)[0].kind, "otro");
  assert.deepEqual(parseWebhook(JSON.parse(fx("estado")), PHONE_ID), []);
  assert.deepEqual(parseWebhook(JSON.parse(fx("otro_numero")), PHONE_ID), []);
  assert.deepEqual(parseWebhook({ object: "page" }, PHONE_ID), []);
});

test("comando: BORRAR, PERSONA y PERFIL con mayúsculas, tildes y signos", () => {
  assert.equal(comando("BORRAR"), "borrar");
  assert.equal(comando(" Olvidame! "), "borrar");
  assert.equal(comando("¿Persona?"), "persona");
  assert.equal(comando("hablar con una persona"), "persona");
  assert.equal(comando("cambiar perfil"), "perfil");
  assert.equal(comando("quiero borrar mi duda sobre becas"), null);
});

test("botones de perfil: 3 como máximo y títulos de hasta 20 caracteres (límite de Meta)", () => {
  assert.ok(BOTONES_PERFIL.length <= 3);
  for (const b of BOTONES_PERFIL) assert.ok(b.title.length <= 20, b.title);
});

// ── Lógica ──

const ev = (o) => ({ id: "wamid." + Math.random(), from: FROM, ts: 0, kind: "text", text: "hola", ...o });
const ask = (calls) => async (db, req) => (calls.push(req), respuestaIA);

test("handleEvent: primer contacto con memoria → bienvenida con botones; después recuerda el perfil", async () => {
  const store = memoryStore();
  const calls = [];
  const a = await handleEvent(ev({ text: "hola" }), { db: DB, store, ask: ask(calls) });
  assert.equal(a.send[0].type, "interactive");
  assert.match(a.send[0].interactive.body.text, /PERSONA/);
  assert.equal(calls.length, 0);

  const b = await handleEvent(ev({ kind: "perfil", perfil: "cit" }), { db: DB, store, ask: ask(calls) });
  assert.equal(b.send[0].text.body, TEXTOS.perfilListo.cit);

  await handleEvent(ev({ text: "¿Hay becas?" }), { db: DB, store, ask: ask(calls) });
  assert.equal(calls[0].perfil, "cit");
  assert.deepEqual(calls[0].messages, [{ role: "user", content: "¿Hay becas?" }]);
});

test("handleEvent: la memoria guarda solo perfil y estado, nunca el texto", async () => {
  const store = memoryStore();
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), { db: DB, store, ask: ask([]) });
  await handleEvent(ev({ text: "mi DNI es 12345678, ¿qué beca me sirve?" }), { db: DB, store, ask: ask([]) });
  const saved = JSON.stringify(store._data.get(FROM));
  assert.doesNotMatch(saved, /DNI|12345678|beca/);
  assert.deepEqual(Object.keys(store._data.get(FROM)).sort(), ["humanoHasta", "perfil", "visto"]);
});

test("handleEvent: PERSONA silencia al bot 24 h; BORRAR borra todo y sigue funcionando", async () => {
  const store = memoryStore();
  const calls = [];
  const now = 1_000_000;
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), { db: DB, store, ask: ask(calls), now });
  const p = await handleEvent(ev({ text: "PERSONA" }), { db: DB, store, ask: ask(calls), now });
  assert.ok(p.handoff);
  const quiet = await handleEvent(ev({ text: "¿y las becas?" }), { db: DB, store, ask: ask(calls), now: now + 60_000 });
  assert.deepEqual(quiet.send, []);
  assert.equal(calls.length, 0);
  const later = await handleEvent(ev({ text: "¿y las becas?" }), {
    db: DB,
    store,
    ask: ask(calls),
    now: now + 25 * 3600_000,
  });
  assert.equal(calls.length, 1);
  assert.equal(later.metric, "ia");

  const del = await handleEvent(ev({ text: "borrar" }), { db: DB, store, ask: ask(calls), now });
  assert.equal(del.send[0].text.body, TEXTOS.borrado);
  assert.equal(store._data.has(FROM), false);
});

test("handleEvent: un mensaje repetido por Meta no se responde dos veces", async () => {
  const store = memoryStore();
  const e = ev({ kind: "perfil", perfil: "ar" });
  assert.equal((await handleEvent(e, { db: DB, store, ask: ask([]) })).send.length, 1);
  assert.equal((await handleEvent(e, { db: DB, store, ask: ask([]) })).metric, "repetido");
});

test("handleEvent: sin memoria (ZL-66 pendiente) responde directo con perfil ar y no promete silencio", async () => {
  const calls = [];
  const r = await handleEvent(ev({ text: "¿Hay becas?" }), { db: DB, store: null, ask: ask(calls) });
  assert.equal(calls[0].perfil, "ar");
  assert.equal(r.metric, "ia");
  const p = await handleEvent(ev({ text: "persona" }), { db: DB, store: null, ask: ask(calls) });
  assert.equal(p.send[0].text.body, TEXTOS.personaSinMemoria);
});

test("handleEvent: audio o foto → pide texto sin llamar a la IA", async () => {
  const calls = [];
  const r = await handleEvent(ev({ kind: "otro" }), { db: DB, store: null, ask: ask(calls) });
  assert.equal(r.send[0].text.body, TEXTOS.soloTexto);
  assert.equal(calls.length, 0);
});

test("formatAnswer: respuesta + fuentes oficiales de las fichas + cómo pedir una persona", () => {
  const t = formatAnswer({ ...respuestaIA, derivar_whatsapp: true });
  assert.match(t, /^Te sirve la beca/);
  assert.match(t, /- Beca de lengua croata\n {2}Fuente oficial: https:\/\/mzom\.gov\.hr\/beca/);
  assert.match(t, /PERSONA/);
  assert.doesNotMatch(formatAnswer({ ...respuestaIA, derivar_whatsapp: true, fuera_de_tema: true }), /PERSONA/);
});

test("prompt: por WhatsApp se suma el aviso de canal; en la web no cambia", () => {
  const req = { messages: [{ role: "user", content: "hola" }], perfil: "ar" };
  const today = new Date("2026-10-15T12:00:00Z");
  const web = buildRequest(DB, req, { today }).system;
  const wa = buildRequest(DB, req, { today, canal: CANAL_WHATSAPP }).system;
  assert.ok(!web.includes("Canal: WhatsApp"));
  assert.ok(wa.includes(CANAL_WHATSAPP));
  assert.equal(wa.replace(`\n${CANAL_WHATSAPP}\n`, ""), web);
});

// ── De punta a punta por el Worker ──

test("worker /whatsapp: mensaje firmado → 200, consulta a Claude con el canal y responde por la Graph API", async () => {
  const sent = [];
  const waits = [];
  const res = await worker.fetch(
    await post(fx("texto")),
    env,
    { waitUntil: (p) => waits.push(p) },
    { fetch: fakeFetch(sent), store: null, now: NOW },
  );
  assert.equal(res.status, 200);
  await Promise.all(waits);
  assert.ok(sent.claude.system.includes("Canal: WhatsApp"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, `https://graph.facebook.com/v23.0/${PHONE_ID}/messages`);
  assert.equal(sent[0].auth, "Bearer token-de-prueba");
  assert.equal(sent[0].body.to, FROM);
  assert.match(sent[0].body.text.body, /Fuente oficial: https:\/\//);
});

test("worker /whatsapp: si Claude falla, igual responde 200 a Meta y le avisa a la persona", async () => {
  const sent = [];
  const f = fakeFetch(sent);
  const failing = async (url, init) =>
    String(url).startsWith("https://api.anthropic.com") ? new Response("{}", { status: 400 }) : f(url, init);
  const res = await worker.fetch(await post(fx("texto")), env, {}, { fetch: failing, store: null, now: NOW });
  assert.equal(res.status, 200);
  assert.equal(sent[0].body.text.body, TEXTOS.falla);
});

test("worker /whatsapp: avisos de estado → 200 sin mandar nada", async () => {
  const sent = [];
  const res = await worker.fetch(await post(fx("estado")), env, {}, { fetch: fakeFetch(sent), store: null, now: NOW });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test("worker /whatsapp: pasado el límite por número no contesta nada ni llama a la IA", async () => {
  const sent = [];
  const keys = [];
  const LIMITER = { limit: async ({ key }) => (keys.push(key), { success: false }) };
  await worker.fetch(
    await post(fx("texto")),
    { ...env, LIMITER },
    {},
    { fetch: fakeFetch(sent), store: null, now: NOW },
  );
  assert.deepEqual(keys, [`wa:${FROM}`]);
  assert.equal(sent.length, 0);
  assert.equal(sent.claude, undefined);
});

test("worker /whatsapp: un mensaje de hace más de 1 h (reintento tardío o reenvío) se ignora", async () => {
  const sent = [];
  const res = await worker.fetch(
    await post(fx("texto")),
    env,
    {},
    { fetch: fakeFetch(sent), store: null, now: NOW + 2 * 3600_000 },
  );
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
  assert.equal(sent.claude, undefined);
});

test("worker /whatsapp: cuerpo enorme → 413 antes de procesar", async () => {
  const req = new Request("https://api.zustrolabs.com/whatsapp", {
    method: "POST",
    headers: { "content-length": "999999", "X-Hub-Signature-256": "sha256=" + "0".repeat(64) },
    body: "{}",
  });
  assert.equal((await worker.fetch(req, env, {}, {})).status, 413);
});

test("verificación: no refleja un challenge que no tenga forma de challenge", () => {
  const u = new URL(
    "https://api.zustrolabs.com/whatsapp?hub.mode=subscribe&hub.verify_token=verificar-de-prueba&hub.challenge=%3Cscript%3E",
  );
  assert.equal(verifySubscription(u, env).status, 400);
});

test("formatAnswer: un link que no es https no se muestra", () => {
  const t = formatAnswer({ ...respuestaIA, fichas: [{ id: "x", t: "Ficha", src: ["x", "javascript:alert(1)"] }] });
  assert.doesNotMatch(t, /javascript|Fuente oficial/);
  assert.match(t, /- Ficha/);
});

test("handleEvent: el texto se limpia como en la web (control y 800 caracteres)", async () => {
  const calls = [];
  await handleEvent(ev({ text: "hola\u0007" + "a".repeat(2000) }), { db: DB, store: null, ask: ask(calls) });
  assert.equal(calls[0].messages[0].content.length, 800);
  assert.ok(!calls[0].messages[0].content.includes("\u0007"));
});

test("bienvenida: avisa que es automático, qué se guarda y cómo borrarlo", async () => {
  const r = await handleEvent(ev({ text: "hola" }), { db: DB, store: memoryStore(), ask: ask([]) });
  const t = r.send[0].interactive.body.text;
  assert.ok(t.length <= 1024);
  for (const x of [/automático/, /no asesoramiento legal/, /nunca tus mensajes/, /90 días/, /BORRAR/, /PERSONA/]) {
    assert.match(t, x);
  }
});
