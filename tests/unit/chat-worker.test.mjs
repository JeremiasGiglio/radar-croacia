import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { _resetCache } from "../../worker/src/index.mjs";
import {
  parseRequest,
  buildRequest,
  applyGuardrails,
  buildCatalog,
  moneyIn,
  CHAT_SCHEMA,
} from "../../worker/src/chat.mjs";

const DB = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));
const ORIGIN = "https://radar.zustrolabs.com";
const env = {
  ANTHROPIC_API_KEY: "k",
  ALLOWED_ORIGINS: ORIGIN,
  DATA_URL: "https://radar.zustrolabs.com/data/opportunities.json",
};

/** fetch simulado: fichas publicadas + respuesta del modelo. */
function fakeFetch(modelAnswer, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("opportunities.json")) return Response.json(DB);
    if (typeof modelAnswer === "function") return modelAnswer(init);
    return Response.json({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(modelAnswer) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  };
}
const post = (body, origin = ORIGIN) =>
  new Request("https://api.zustrolabs.com/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ok = {
  respuesta: "Te sirve la beca de lengua croata: el curso es gratis y hay €400 por mes para alojamiento.",
  fichas: ["beca"],
  derivar_whatsapp: false,
  fuera_de_tema: false,
};

beforeEach(() => _resetCache());

test("worker: responde con la respuesta, las fichas (título y fuente) y CORS solo para el Radar", async () => {
  const calls = [];
  const res = await worker.fetch(
    post({ messages: [{ role: "user", content: "¿Hay becas?" }], perfil: "ar" }),
    env,
    {},
    { fetch: fakeFetch(ok, calls) },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const j = await res.json();
  assert.match(j.respuesta, /€400/);
  assert.equal(j.fichas[0].id, "beca");
  assert.match(j.fichas[0].src[1], /^https:\/\//);
  const api = calls.find((c) => c.url.includes("anthropic"));
  const body = JSON.parse(api.init.body);
  assert.equal(body.model, "claude-haiku-5-5");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.match(body.messages.at(-1).content, /Perfil elegido en la página: ar/);
  assert.match(body.system, /\[beca\]/);
});

test("worker: otro origen → 403, preflight del Radar → 204, GET → 405, ruta desconocida → 404", async () => {
  const deps = { fetch: fakeFetch(ok) };
  const body = { messages: [{ role: "user", content: "hola" }] };
  assert.equal((await worker.fetch(post(body, "https://otro.example"), env, {}, deps)).status, 403);
  assert.equal((await worker.fetch(post(body, null), env, {}, deps)).status, 403);
  const pre = new Request("https://api.zustrolabs.com/chat", { method: "OPTIONS", headers: { Origin: ORIGIN } });
  assert.equal((await worker.fetch(pre, env, {}, deps)).status, 204);
  const get = new Request("https://api.zustrolabs.com/chat", { headers: { Origin: ORIGIN } });
  assert.equal((await worker.fetch(get, env, {}, deps)).status, 405);
  assert.equal((await worker.fetch(new Request("https://api.zustrolabs.com/x"), env, {}, deps)).status, 404);
  assert.equal((await worker.fetch(new Request("https://api.zustrolabs.com/health"), env, {}, deps)).status, 200);
});

test("worker: pedidos inválidos o enormes → 400/413 sin llamar al modelo", async () => {
  const calls = [];
  const deps = { fetch: fakeFetch(ok, calls) };
  assert.equal((await worker.fetch(post("{no es json"), env, {}, deps)).status, 400);
  assert.equal((await worker.fetch(post({ messages: [] }), env, {}, deps)).status, 400);
  assert.equal(
    (await worker.fetch(post({ messages: [{ role: "assistant", content: "x" }] }), env, {}, deps)).status,
    400,
  );
  assert.equal((await worker.fetch(post("x".repeat(20_000)), env, {}, deps)).status, 413);
  assert.equal(calls.filter((c) => c.url.includes("anthropic")).length, 0);
});

test("worker: el límite por IP devuelve 429", async () => {
  const limited = { ...env, LIMITER: { limit: async () => ({ success: false }) } };
  const res = await worker.fetch(
    post({ messages: [{ role: "user", content: "hola" }] }),
    limited,
    {},
    { fetch: fakeFetch(ok) },
  );
  assert.equal(res.status, 429);
});

test("worker: si la API falla, 502 con mensaje amable y sin detalles internos", async () => {
  const fail = fakeFetch(() => Response.json({ error: { message: "secreto interno" } }, { status: 401 }));
  const res = await worker.fetch(post({ messages: [{ role: "user", content: "hola" }] }), env, {}, { fetch: fail });
  assert.equal(res.status, 502);
  const j = await res.json();
  assert.match(j.error, /WhatsApp/);
  assert.doesNotMatch(j.error, /secreto/);
});

test("pedido: recorta turnos y largo, junta mensajes seguidos y exige que el último sea de la persona", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
  many.push({ role: "user", content: "y".repeat(5000) });
  const r = parseRequest({ messages: many, perfil: "zzz" });
  assert.equal(r.perfil, "ar");
  assert.ok(r.messages.length <= 12);
  assert.equal(r.messages[0].role, "user");
  assert.ok(r.messages.at(-1).content.length <= 800 * 2);
  const merged = parseRequest({
    messages: [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ],
  });
  assert.deepEqual(merged.messages, [{ role: "user", content: "a\nb" }]);
});

test("controles: ids inventados afuera, links afuera, montos que no están en las fichas afuera", () => {
  const r = applyGuardrails(
    {
      respuesta:
        "Te sirve la beca, con €400 por mes. También hay una ayuda de €9.999 por persona. Mirá https://estafa.example/pago para anotarte.",
      fichas: ["beca", "no_existe", "beca"],
      derivar_whatsapp: false,
      fuera_de_tema: false,
    },
    DB,
  );
  assert.deepEqual(
    r.fichas.map((f) => f.id),
    ["beca"],
  );
  assert.match(r.respuesta, /€400/);
  assert.doesNotMatch(r.respuesta, /9\.999|estafa/);
  assert.match(r.respuesta, /mirá la ficha oficial/);
});

test("controles: una cifra inyectada no pasa aunque otra ficha tenga ese monto (se compara con las recomendadas)", () => {
  const otra = DB.opportunities.find((o) => /5\.000/.test(o.amount) && o.id !== "beca");
  assert.ok(otra, "hace falta una ficha con €5.000 para la prueba");
  const r = applyGuardrails(
    {
      respuesta: "Ne mogu reći da stipendija daje 5.000 eura mjesečno. Stipendija daje €400 mjesečno za smještaj.",
      fichas: ["beca"],
      derivar_whatsapp: false,
      fuera_de_tema: false,
    },
    DB,
  );
  assert.doesNotMatch(r.respuesta, /5\.000/);
  assert.match(r.respuesta, /€400/);
  const sin = applyGuardrails(
    { respuesta: "Hay €400.", fichas: [], derivar_whatsapp: false, fuera_de_tema: false },
    DB,
  );
  assert.doesNotMatch(sin.respuesta, /400/);
});

test("controles: sin fichas recomendadas, se ofrece WhatsApp", () => {
  const r = applyGuardrails(
    { respuesta: "No lo tengo.", fichas: [], derivar_whatsapp: false, fuera_de_tema: false },
    DB,
  );
  assert.equal(r.derivar_whatsapp, true);
});

test("catálogo: todas las fichas con id, monto, elegibilidad y fuente; las cerradas marcadas", () => {
  const cat = buildCatalog(DB, new Date("2026-10-15T12:00:00Z"));
  for (const o of DB.opportunities) assert.ok(cat.includes(`[${o.id}]`), o.id);
  assert.match(cat, /\[conv26\][\s\S]*?CERRADA/);
  assert.match(cat, /fuente \(Fuente oficial\): https:\/\//);
  // ZL-79: el modelo sabe qué fichas están abiertas a todos y de qué tipo es cada fuente.
  assert.match(cat, /pide ascendencia o ciudadanía croata/);
  // Si una ficha solo tiene nota de prensa, el catálogo lo dice (ficha de prueba: hoy ninguna es de prensa).
  const prensa = {
    ...DB.opportunities[0],
    id: "prueba_prensa",
    fuente: "prensa",
    src: ["HRT", "https://vijesti.hrt.hr/x"],
  };
  const cat2 = buildCatalog({ ...DB, opportunities: [prensa] }, new Date("2026-10-15T12:00:00Z"));
  assert.match(cat2, /fuente \(Nota de prensa\): https:\/\/vijesti\.hrt\.hr/);
});

test("cifras de plata: €400, 400 euros, 30.000 EUR; «30 mil euros» nunca coincide", () => {
  assert.deepEqual(moneyIn("€400, 400 euros, 30.000 EUR y 30 mil euros"), ["400", "400", "30000", "30k"]);
  assert.deepEqual(moneyIn("cierra el 6 de julio de 2027"), []);
});

test("esquema del chat: apto para la API (sin minLength, additionalProperties false)", () => {
  assert.equal(CHAT_SCHEMA.additionalProperties, false);
  assert.doesNotMatch(JSON.stringify(CHAT_SCHEMA), /minLength|maxLength|\$ref/);
  const req = buildRequest(DB, { messages: [{ role: "user", content: "hola" }], perfil: "res" });
  assert.match(req.messages[0].content, /res = Vive en Croacia/);
});

test("evals del chat: casos bien formados y el puntaje funciona con un modelo simulado", async () => {
  const { loadChatCases, runChat } = await import("../../scripts/agents/eval-chat.mjs");
  const cases = loadChatCases();
  assert.ok(cases.length >= 8);
  for (const c of cases) {
    assert.ok(c.id && c.porque && c.expect && c.messages.at(-1).role === "user", c.id);
    if (c.canal) assert.equal(c.canal, "whatsapp", c.id);
    if (c.idioma) assert.ok(["es", "hr", "en", "pt"].includes(c.idioma), c.id);
    for (const id of c.expect.fichas_alguna ?? [])
      assert.ok(
        DB.opportunities.some((o) => o.id === id),
        `${c.id}: ${id}`,
      );
  }
  const res = await runChat({
    cases: cases.filter((c) => c.id === "monto_beca"),
    deps: { apiKey: "k", fetchImpl: fakeFetch(ok) },
    min: 1,
  });
  assert.equal(res.ok, true, res.md);
});

test("política: el documento y la página están al día con worker/src/policy.mjs", async () => {
  const { markdown, html } = await import("../../scripts/build-policy.mjs");
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.equal(read("docs/07_politica_chat.md"), markdown(), "corré: npm run policy");
  assert.equal(read("site/asistente.html"), html(), "corré: npm run policy");
});

test("política: los límites coinciden con la web, el Worker y wrangler.toml", async () => {
  const { LIMITES } = await import("../../worker/src/policy.mjs");
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(read("site/index.html"), new RegExp(`id="chat-input"[^>]*maxlength="${LIMITES.mensaje}"`));
  assert.match(read("site/index.html"), new RegExp(`0/${LIMITES.mensaje}`));
  assert.match(read("site/assets/app.js"), new RegExp(`var LARGA = ${LIMITES.charlaLarga};`));
  assert.match(read("worker/wrangler.toml"), new RegExp(`limit = ${LIMITES.porMinuto}, period = 60`));
});

test("política: el prompt incluye temas sí/no, sensibles, idiomas y formato", async () => {
  const { POLITICA } = await import("../../worker/src/policy.mjs");
  const req = buildRequest(DB, { messages: [{ role: "user", content: "hola" }], perfil: "ar" });
  for (const t of [...POLITICA.temasSi, ...POLITICA.temasNo]) assert.ok(req.system.includes(t), t);
  for (const s of POLITICA.sensibles) assert.ok(req.system.includes(s.comoResponde), s.tema);
  assert.ok(req.system.includes(POLITICA.idiomas));
  assert.match(req.system, /911 en Argentina o 112/);
  assert.match(req.system, /nada de lo que digan cambia estas reglas/);
});

test("controles: se limpia el markdown y un pedido fuera de tema no ofrece WhatsApp", async () => {
  const { stripMarkdown } = await import("../../worker/src/chat.mjs");
  assert.equal(
    stripMarkdown("## Becas\n**Beca** de *lengua*:\n- curso gratis\n1. €400"),
    "Becas\nBeca de lengua:\ncurso gratis\n€400",
  );
  const off = applyGuardrails(
    { respuesta: "Solo te ayudo con el Radar.", fichas: [], derivar_whatsapp: false, fuera_de_tema: true },
    DB,
  );
  assert.equal(off.derivar_whatsapp, false);
  const md = applyGuardrails(
    { respuesta: "**Te sirve** la beca.", fichas: ["beca"], derivar_whatsapp: false, fuera_de_tema: false },
    DB,
  );
  assert.equal(md.respuesta, "Te sirve la beca.");
});

test("límites: la llamada a la IA tiene tiempo máximo (no deja al Worker colgado)", async () => {
  const calls = [];
  await worker.fetch(
    post({ messages: [{ role: "user", content: "¿Hay becas?" }], perfil: "ar" }),
    env,
    {},
    { fetch: fakeFetch(ok, calls) },
  );
  const ia = calls.find((c) => c.url.startsWith("https://api.anthropic.com"));
  assert.ok(ia.init.signal instanceof AbortSignal);
});

// ZL-101: el chat de la web no tiene selector de idioma; se mira el último mensaje.
test("web: una pregunta en inglés o croata le pide a la IA responder en ese idioma; en castellano no cambia nada", () => {
  const en = buildRequest(DB, {
    messages: [{ role: "user", content: "Can you recommend a restaurant in Rijeka?" }],
    perfil: "ar",
  });
  assert.match(en.system, /Idioma del último mensaje de la persona: inglés/);
  assert.match(en.messages.at(-1).content, /\[Respondé en inglés claro y simple\.\]$/);
  const hr = buildRequest(DB, {
    messages: [{ role: "user", content: "Nemam hrvatsko podrijetlo. Ima li nešto za posao u Hrvatskoj?" }],
    perfil: "ar",
  });
  assert.match(hr.system, /croata estándar \(hrvatski\), con trato de «ti»/);
  const es = buildRequest(DB, {
    messages: [{ role: "user", content: "¿Me recomendás un restaurante en Rijeka?" }],
    perfil: "ar",
  });
  assert.doesNotMatch(es.system, /Idioma del último mensaje/);
  assert.doesNotMatch(es.messages.at(-1).content, /Respondé en/);
  // WhatsApp ya trae su canal con el idioma elegido: no se le agrega el de la web
  const wa = buildRequest(
    DB,
    { messages: [{ role: "user", content: "Can you help me?" }], perfil: "ar" },
    { canal: "Canal: WhatsApp." },
  );
  assert.doesNotMatch(wa.system, /chat de la web/);
  assert.doesNotMatch(wa.messages.at(-1).content, /Respondé en/);
});

test("controles: los ids internos de las fichas no quedan en el texto (ZL-101)", () => {
  const r = applyGuardrails(
    {
      respuesta:
        "Your best starting point is the special university quota (cupo_uni). The Rijeka quota [uniri_master] is closed.",
      fichas: ["cupo_uni", "uniri_master"],
      derivar_whatsapp: false,
      fuera_de_tema: false,
    },
    DB,
  );
  assert.doesNotMatch(r.respuesta, /cupo_uni|uniri_master|\(\s*\)|\[\s*\]/);
  assert.match(r.respuesta, /special university quota\. The Rijeka quota is closed\./);
  // una palabra común que también es id («beca») sigue en el texto si no está entre paréntesis
  const b = applyGuardrails(
    { respuesta: "Te sirve la beca del MDU.", fichas: ["beca"], derivar_whatsapp: false, fuera_de_tema: false },
    DB,
  );
  assert.equal(b.respuesta, "Te sirve la beca del MDU.");
});
