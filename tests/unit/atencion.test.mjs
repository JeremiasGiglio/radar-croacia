// Panel de atención (ZL-65): charlas guardadas, modo persona, login con Cloudflare Access, API y aviso por mail.
// Datos ficticios: números 549000000000x, mails @example.com.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { _resetCache } from "../../worker/src/index.mjs";
import {
  _resetCerts,
  agregar,
  APP_JS,
  avisar,
  HTML,
  mailAviso,
  MAX_RESPUESTA,
  memoryChats,
  panel,
  TEXTO_DEVUELTA,
  verificarAcceso,
} from "../../worker/src/atencion.mjs";
import { handleEvent, memoryStore, sign, TEXTOS } from "../../worker/src/whatsapp.mjs";

const DB = JSON.parse(readFileSync(new URL("../../site/data/opportunities.json", import.meta.url), "utf8"));
const NUM = "5490000000001";
const T0 = 1_792_000_000_000;
const HORA = 3600_000;
const ORIGIN = "https://atencion.zustrolabs.com";
const TEAM = "equipo-de-prueba.cloudflareaccess.com";
const AUD = "aud-de-prueba";
const ENV = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, PANEL_EMAILS: "yo@example.com" };

const respuestaIA = { respuesta: "Hola", fichas: [], derivar_whatsapp: false, fuera_de_tema: false, usage: {} };
const ask = (calls) => async (db, req) => (calls.push(req), respuestaIA);
const ev = (o) => ({ id: "wamid." + Math.random(), from: NUM, ts: 0, kind: "text", text: "hola", ...o });

// ── JWT de Access firmado con una clave RSA generada para el test ──

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const otras = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" };

async function jwt(payload, { header = { alg: "RS256", kid: "k1" }, key = keys.privateKey } = {}) {
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const data = `${enc(header)}.${enc(payload)}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return `${data}.${b64u(sig)}`;
}
const valido = (o = {}) => ({ aud: [AUD], email: "yo@example.com", exp: Math.floor(T0 / 1000) + 48 * 3600, ...o });

let certCalls = 0;
const fetchCerts = async (url) => {
  certCalls++;
  assert.equal(String(url), `https://${TEAM}/cdn-cgi/access/certs`);
  return Response.json({ keys: [jwk] });
};

async function pedido(path, { method = "GET", token, body, origin = ORIGIN, type = "application/json" } = {}) {
  const headers = {};
  if (token !== null) headers["Cf-Access-Jwt-Assertion"] = token ?? (await jwt(valido()));
  if (origin) headers.Origin = origin;
  if (type) headers["content-type"] = type;
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

function deps(o = {}) {
  const sent = [];
  return {
    sent,
    fetch: fetchCerts,
    now: T0,
    store: memoryStore(),
    chats: memoryChats(),
    send: async (env, m) => void sent.push(m),
    ...o,
  };
}

beforeEach(() => {
  _resetCerts();
  _resetCache();
  certCalls = 0;
});

// ── Charlas guardadas ──

test("agregar: crea la charla, suma mensajes y marca el último de la persona", async () => {
  const chats = memoryChats();
  await agregar(chats, NUM, { de: "persona", texto: "Hola" }, T0);
  const c = await agregar(chats, NUM, { de: "equipo", texto: "¿En qué te ayudo?" }, T0 + 1000);
  assert.equal(c.mensajes.length, 2);
  assert.equal(c.ultimoPersona, T0);
  assert.equal(c.ultimo, T0 + 1000);
  const [i] = await chats.list();
  assert.deepEqual(Object.keys(i).sort(), ["abierta", "idioma", "num", "ultimo", "ultimoPersona"]); // el índice no tiene texto
});

test("agregar: límites de tamaño (200 mensajes, 1.600 caracteres cada uno)", async () => {
  const chats = memoryChats();
  for (let i = 0; i < 205; i++) await agregar(chats, NUM, { de: "persona", texto: "x".repeat(5000) }, T0 + i);
  const c = await chats.get(NUM);
  assert.equal(c.mensajes.length, 200);
  assert.equal(c.mensajes[0].texto.length, 1600);
});

// ── Modo persona en el bot ──

test("PERSONA con panel: abre la charla, avisa 30 días y pide mandar el mail", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), { db: DB, store, ask: ask([]), now: T0 });
  const p = await handleEvent(ev({ text: "PERSONA" }), { db: DB, store, ask: ask([]), now: T0, panel: true, chats });
  assert.equal(p.send[0].text.body, TEXTOS.persona);
  assert.match(TEXTOS.persona, /30 días/);
  assert.match(TEXTOS.persona, /BORRAR/);
  assert.equal(p.notify, true);
  const c = await chats.get(NUM);
  assert.equal(c.abierta, true);
  assert.equal(c.ultimoPersona, T0);
});

test("modo persona: el bot no contesta ni llama a la IA, y el mensaje queda para el equipo", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  const calls = [];
  const d = { db: DB, store, ask: ask(calls), panel: true, chats };
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), { ...d, now: T0 });
  await handleEvent(ev({ text: "persona" }), { ...d, now: T0 });
  const r = await handleEvent(ev({ text: "Necesito ayuda con mi caso" }), { ...d, now: T0 + 20 * HORA });
  const audio = await handleEvent(ev({ kind: "otro" }), { ...d, now: T0 + 21 * HORA });
  assert.deepEqual(r.send, []);
  assert.deepEqual(audio.send, []);
  assert.equal(calls.length, 0);
  const c = await chats.get(NUM);
  assert.deepEqual(
    c.mensajes.filter((m) => m.de === "persona").map((m) => m.texto),
    ["persona", "Necesito ayuda con mi caso", "[Mandó algo que no es texto: audio, foto o archivo]"],
  );
  // Cada mensaje renueva la ventana: a las 30 h del PERSONA sigue en pausa.
  assert.equal(store._data.get(NUM).humanoHasta, T0 + 21 * HORA + 24 * HORA);
  const tarde = await handleEvent(ev({ text: "¿Hola?" }), { ...d, now: T0 + 30 * HORA });
  assert.equal(tarde.metric, "humano");
});

test("modo persona sin panel: no se guarda ningún mensaje", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), { db: DB, store, ask: ask([]), now: T0 });
  const p = await handleEvent(ev({ text: "PERSONA" }), { db: DB, store, ask: ask([]), now: T0, chats });
  assert.equal(p.send[0].text.body, TEXTOS.personaMail);
  assert.ok(!p.notify);
  await handleEvent(ev({ text: "algo" }), { db: DB, store, ask: ask([]), now: T0, chats });
  assert.equal(chats._data.size, 0);
});

test("charla con el bot (sin PERSONA): nunca se guarda el texto", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  const d = { db: DB, store, ask: ask([]), panel: true, chats, now: T0 };
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), d);
  await handleEvent(ev({ text: "¿Hay becas?" }), d);
  assert.equal(chats._data.size, 0);
  assert.ok(!JSON.stringify([...store._data.values()]).includes("becas"));
});

test("BORRAR también borra la charla guardada, aunque esté en modo persona", async () => {
  const store = memoryStore();
  const chats = memoryChats();
  const d = { db: DB, store, ask: ask([]), panel: true, chats, now: T0 };
  await handleEvent(ev({ kind: "perfil", perfil: "ar" }), d);
  await handleEvent(ev({ text: "PERSONA" }), d);
  await handleEvent(ev({ text: "mi consulta" }), d);
  const b = await handleEvent(ev({ text: "BORRAR" }), d);
  assert.equal(b.send[0].text.body, TEXTOS.borrado);
  assert.equal(chats._data.size, 0);
  assert.equal(store._data.size, 0);
  assert.deepEqual(await chats.list(), []);
});

// ── Login (Cloudflare Access) ──

test("panel: sin configuración de Access responde 503 (nunca queda abierto)", async () => {
  for (const env of [{}, { ...ENV, ACCESS_AUD: "" }, { ...ENV, PANEL_EMAILS: "" }]) {
    const r = await panel(await pedido("/"), env, deps());
    assert.equal(r.status, 503);
  }
});

test("panel: token válido de un mail autorizado → entra", async () => {
  const r = await panel(await pedido("/"), ENV, deps());
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Atención · Radar Croacia/);
});

test("panel: rechaza sin token, firma ajena, otra audiencia, vencido, alg none y mail no autorizado", async () => {
  const casos = {
    "sin token": null,
    basura: "no.es.jwt",
    "firma ajena": await jwt(valido(), { key: otras.privateKey }),
    "otra audiencia": await jwt(valido({ aud: ["otra"] })),
    vencido: await jwt(valido({ exp: Math.floor(T0 / 1000) - 1 })),
    "sin vencimiento": await jwt(valido({ exp: undefined })),
    "alg none": (await jwt(valido())).replace(/^[^.]+/, b64u(Buffer.from('{"alg":"none","kid":"k1"}'))),
    "kid desconocido": await jwt(valido(), { header: { alg: "RS256", kid: "otro" } }),
    "mail no autorizado": await jwt(valido({ email: "otro@example.com" })),
  };
  for (const [nombre, token] of Object.entries(casos)) {
    const r = await panel(await pedido("/api/charlas", { token }), ENV, deps());
    assert.equal(r.status, 401, nombre);
  }
});

test("verificarAcceso: mail sin distinguir mayúsculas y claves cacheadas 1 h", async () => {
  const req = await pedido("/", { token: await jwt(valido({ email: "Yo@Example.com" })) });
  assert.equal(await verificarAcceso(req, ENV, fetchCerts, T0), "yo@example.com");
  await verificarAcceso(req, ENV, fetchCerts, T0 + 1000);
  assert.equal(certCalls, 1);
});

test("panel: cabeceras de seguridad (CSP sin inline, sin iframes, sin caché)", async () => {
  const r = await panel(await pedido("/"), ENV, deps());
  const csp = r.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(HTML, /noindex/);
  assert.doesNotMatch(HTML, /<script>|onclick=|style=/);
});

test("panel: el JS pinta todo con textContent (sin innerHTML ni eval)", () => {
  assert.doesNotMatch(APP_JS, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write/);
});

// ── API ──

async function conCharla(d, { ultimoPersona = T0 } = {}) {
  await agregar(d.chats, NUM, { de: "persona", texto: "<img src=x onerror=alert(1)> hola" }, ultimoPersona);
  await d.store.put(NUM, { perfil: "ar", humanoHasta: ultimoPersona + 24 * HORA, visto: ultimoPersona });
}

test("API: lista y charla, con el tiempo que queda para responder", async () => {
  const d = deps({ now: T0 + 2 * HORA });
  await conCharla(d);
  const l = await (await panel(await pedido("/api/charlas"), ENV, d)).json();
  assert.equal(l.charlas.length, 1);
  assert.equal(l.charlas[0].num, NUM);
  assert.equal(l.charlas[0].quedaMs, 22 * HORA);
  assert.equal(l.yo, "yo@example.com");
  const c = await (await panel(await pedido(`/api/charlas/${NUM}`), ENV, d)).json();
  assert.equal(c.mensajes[0].texto, "<img src=x onerror=alert(1)> hola"); // es dato: el panel lo muestra como texto
  assert.equal((await panel(await pedido("/api/charlas/5490000000009"), ENV, d)).status, 404);
  assert.equal((await panel(await pedido("/api/charlas/../../wa"), ENV, d)).status, 404);
  assert.equal((await panel(await pedido("/api/charlas/123"), ENV, d)).status, 404);
});

test("API responder: manda por WhatsApp, guarda la respuesta y el bot sigue en pausa", async () => {
  const d = deps({ now: T0 + HORA });
  await conCharla(d);
  const body = JSON.stringify({ texto: "Hola, soy del equipo.\u0007" });
  const r = await panel(await pedido(`/api/charlas/${NUM}/responder`, { method: "POST", body }), ENV, d);
  assert.equal(r.status, 200);
  assert.equal(d.sent.length, 1);
  assert.equal(d.sent[0].to, NUM);
  assert.equal(d.sent[0].text.body, "Hola, soy del equipo.");
  assert.equal(d.sent[0].text.preview_url, false);
  const c = await d.chats.get(NUM);
  assert.equal(c.mensajes.at(-1).de, "equipo");
  assert.equal((await d.store.get(NUM)).humanoHasta, T0 + HORA + 24 * HORA);
});

test("API responder: después de 24 h del último mensaje de la persona, WhatsApp no deja (409)", async () => {
  const d = deps({ now: T0 + 25 * HORA });
  await conCharla(d);
  const body = JSON.stringify({ texto: "Perdón la demora" });
  const r = await panel(await pedido(`/api/charlas/${NUM}/responder`, { method: "POST", body }), ENV, d);
  assert.equal(r.status, 409);
  assert.equal(d.sent.length, 0);
});

test("API responder: vacío, demasiado largo o JSON roto → 400", async () => {
  const d = deps();
  await conCharla(d);
  for (const body of [
    JSON.stringify({ texto: "   " }),
    JSON.stringify({ texto: "a".repeat(MAX_RESPUESTA + 1) }),
    "{",
  ]) {
    const r = await panel(await pedido(`/api/charlas/${NUM}/responder`, { method: "POST", body }), ENV, d);
    assert.equal(r.status, 400);
  }
  assert.equal(d.sent.length, 0);
});

test("API: sin CSRF (Origin ajeno o sin Origin → 403; formulario → 415; GET a una acción → 405)", async () => {
  const d = deps();
  await conCharla(d);
  const body = JSON.stringify({ texto: "hola" });
  const url = `/api/charlas/${NUM}/responder`;
  assert.equal(
    (await panel(await pedido(url, { method: "POST", body, origin: "https://malo.example" }), ENV, d)).status,
    403,
  );
  assert.equal((await panel(await pedido(url, { method: "POST", body, origin: null }), ENV, d)).status, 403);
  assert.equal(
    (
      await panel(
        await pedido(url, { method: "POST", body: "texto=hola", type: "application/x-www-form-urlencoded" }),
        ENV,
        d,
      )
    ).status,
    415,
  );
  assert.equal((await panel(await pedido(url), ENV, d)).status, 405);
  assert.equal(d.sent.length, 0);
});

test("API responder: si WhatsApp rechaza, 502 y no se guarda como enviado", async () => {
  const d = deps({
    send: async () => {
      throw new Error("WhatsApp 400: no");
    },
  });
  await conCharla(d);
  const body = JSON.stringify({ texto: "hola" });
  const r = await panel(await pedido(`/api/charlas/${NUM}/responder`, { method: "POST", body }), ENV, d);
  assert.equal(r.status, 502);
  assert.equal((await d.chats.get(NUM)).mensajes.length, 1);
});

test("API devolver: el bot vuelve a contestar y se le avisa a la persona", async () => {
  const d = deps({ now: T0 + HORA });
  await conCharla(d);
  const r = await panel(await pedido(`/api/charlas/${NUM}/devolver`, { method: "POST", body: "{}" }), ENV, d);
  assert.equal(r.status, 200);
  // ZL-103: la respuesta trae el tiempo real que queda (antes el panel mostraba «pasaron más de 24 h»)
  const cuerpo = await r.json();
  assert.equal(cuerpo.chat.quedaMs, 23 * HORA);
  assert.equal(cuerpo.chat.abierta, false);
  assert.equal(d.sent[0].text.body, TEXTO_DEVUELTA);
  assert.equal((await d.store.get(NUM)).humanoHasta, 0);
  assert.equal((await d.chats.get(NUM)).abierta, false);
  const calls = [];
  const sig = await handleEvent(ev({ text: "¿Hay becas?" }), {
    db: DB,
    store: d.store,
    ask: ask(calls),
    now: T0 + 2 * HORA,
    panel: true,
    chats: d.chats,
  });
  assert.equal(sig.metric, "ia");
});

// ── Aviso por mail ──

test("mail de aviso: corto, con el link al panel y sin número ni texto de la persona", () => {
  const m = mailAviso({ from: "avisos@avisos.zustrolabs.com", to: "yo@example.com", now: new Date(T0) });
  assert.match(m, /^From: Radar Croacia <avisos@avisos\.zustrolabs\.com>\r\n/);
  assert.match(m, /\r\nSubject: Radar Croacia: hay una charla esperando\r\n/);
  assert.match(m, /https:\/\/atencion\.zustrolabs\.com/);
  assert.doesNotMatch(m, /\d{8,}@|549\d|wamid/);
});

test("avisar: sin binding o sin destinatario no hace nada; con ambos manda un mail", async () => {
  assert.equal(await avisar({}), false);
  assert.equal(await avisar({ AVISO: { send: async () => {} } }), false);
  const enviados = [];
  class FakeEmail {
    constructor(from, to, raw) {
      Object.assign(this, { from, to, raw });
    }
  }
  const env = { AVISO: { send: async (m) => void enviados.push(m) }, AVISO_PARA: "yo@example.com" };
  assert.equal(await avisar(env, FakeEmail, new Date(T0)), true);
  assert.equal(enviados[0].to, "yo@example.com");
  assert.equal(enviados[0].from, "avisos@avisos.zustrolabs.com");
});

// ── De punta a punta por el Worker ──

const PHONE_ID = "100000000000001";
const WA_ENV = {
  ANTHROPIC_API_KEY: "k",
  DATA_URL: "https://radar.zustrolabs.com/data/opportunities.json",
  WHATSAPP_APP_SECRET: "secreto-de-prueba",
  WHATSAPP_TOKEN: "token-de-prueba",
  WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
};
const payload = (text, id) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "200000000000002",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_ID },
              messages: [{ from: NUM, id, timestamp: String(T0 / 1000), type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });
const fakeGraph = (sent) => async (url, init) => {
  const u = String(url);
  if (u.endsWith("opportunities.json")) return Response.json(DB);
  if (u.startsWith("https://graph.facebook.com")) return (sent.push(JSON.parse(init.body)), Response.json({}));
  throw new Error("fetch inesperado " + u);
};
async function wa(text, id, env, d) {
  const body = payload(text, id);
  const req = new Request("https://api.zustrolabs.com/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hub-Signature-256": await sign(body, env.WHATSAPP_APP_SECRET) },
    body,
  });
  return worker.fetch(req, env, {}, d);
}

test("worker: con WHATSAPP_PANEL=1, PERSONA abre la charla y manda el aviso por mail", async () => {
  const sent = [];
  let avisos = 0;
  const store = memoryStore();
  await store.put(NUM, { perfil: "ar", humanoHasta: 0, visto: T0 });
  const d = {
    fetch: fakeGraph(sent),
    store,
    chats: memoryChats(),
    now: T0 + 1000,
    notify: async () => (avisos++, true),
  };
  const env = { ...WA_ENV, ...ENV, WHATSAPP_PANEL: "1" };
  assert.equal((await wa("PERSONA", "wamid.A", env, d)).status, 200);
  assert.equal(sent[0].text.body, TEXTOS.persona);
  assert.equal(avisos, 1);
  await wa("Mi consulta", "wamid.B", env, d);
  assert.equal(sent.length, 1); // el bot no contesta
  assert.equal((await d.chats.get(NUM)).mensajes.at(-1).texto, "Mi consulta");
  assert.equal(avisos, 1); // un solo aviso por pedido de PERSONA
});

test("worker: si el mail de aviso falla, la persona igual recibe la confirmación", async () => {
  const sent = [];
  const store = memoryStore();
  await store.put(NUM, { perfil: "ar", humanoHasta: 0, visto: T0 });
  const d = {
    fetch: fakeGraph(sent),
    store,
    chats: memoryChats(),
    now: T0 + 1000,
    notify: async () => {
      throw new Error("mail caído");
    },
  };
  await wa("PERSONA", "wamid.C", { ...WA_ENV, ...ENV, WHATSAPP_PANEL: "1" }, d);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text.body, TEXTOS.persona);
});

test("worker: con WHATSAPP_PANEL=1 pero sin el login completo, PERSONA deriva al mail y el bot no se calla", async () => {
  for (const falta of ["PANEL_EMAILS", "ACCESS_AUD", "ACCESS_TEAM_DOMAIN"]) {
    const sent = [];
    const store = memoryStore();
    await store.put(NUM, { perfil: "ar", humanoHasta: 0, visto: T0 });
    const chats = memoryChats();
    const env = { ...WA_ENV, ...ENV, WHATSAPP_PANEL: "1", [falta]: "" };
    await wa("PERSONA", "wamid.F" + falta, env, {
      fetch: fakeGraph(sent),
      store,
      chats,
      now: T0 + 1000,
      notify: async () => true,
    });
    assert.equal(sent[0].text.body, TEXTOS.personaMail, falta);
    assert.equal(chats._data.size, 0, falta);
    assert.equal((await store.get(NUM)).humanoHasta, 0, falta);
  }
});

test("wrangler.toml: el panel está prendido con el login de Access (dominio y audiencia, que no son secretos)", () => {
  const toml = readFileSync(new URL("../../worker/wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /^WHATSAPP_PANEL = "1"$/m);
  assert.match(toml, /^ACCESS_TEAM_DOMAIN = "[a-z0-9-]+\.cloudflareaccess\.com"$/m);
  assert.match(toml, /^ACCESS_AUD = "[0-9a-f]{64}"$/m);
});

test("worker: el host atencion.zustrolabs.com va al panel (y sin Access configurado, 503)", async () => {
  const r = await worker.fetch(
    new Request(`${ORIGIN}/whatsapp`, { method: "POST" }),
    WA_ENV,
    {},
    { store: null, chats: null },
  );
  assert.equal(r.status, 503);
  const api = await worker.fetch(new Request("https://api.zustrolabs.com/api/charlas"), WA_ENV, {}, {});
  assert.equal(api.status, 404); // el panel no existe en api.zustrolabs.com
});

test("wrangler.toml: ruta del panel, binding de mail y sin mails personales en el repo", () => {
  const toml = readFileSync(new URL("../../worker/wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /pattern = "atencion\.zustrolabs\.com", custom_domain = true/);
  assert.match(toml, /^\[\[send_email\]\]\s*\nname = "AVISO"/m);
  assert.doesNotMatch(toml, /@gmail\.com|destination_address/);
  assert.doesNotMatch(toml, /^PANEL_EMAILS|^AVISO_PARA/m); // son secretos
});

test("privacidad: la página pública explica qué se guarda con PERSONA y por cuánto", () => {
  const html = readFileSync(new URL("../../site/privacidad.html", import.meta.url), "utf8");
  assert.match(html, /PERSONA/);
  assert.match(html, /30 días/);
});

test("panel (ZL-103): con la charla devuelta al bot no dice «pasaron más de 24 h», y la línea del sistema no empieza con «·»", () => {
  assert.match(APP_JS, /La atiende el bot/);
  assert.doesNotMatch(APP_JS, /quedaMs:0\}/);
  assert.doesNotMatch(APP_JS, /quedaMs:86400000/);
  assert.match(APP_JS, /\(q\?q\+" · ":""\)\+hora\(m\.t\)/);
});
