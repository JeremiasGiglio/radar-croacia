// Worker del Radar (api.zustrolabs.com): POST /chat → asistente con Claude Haiku sobre las fichas verificadas.
// No guarda mensajes ni datos personales: cada pedido trae la charla y se olvida al responder.
// /whatsapp → webhook de la Cloud API de Meta (ZL-22), con el mismo cerebro (whatsapp.mjs).
import { answer, parseRequest } from "./chat.mjs";
// (parseRequest también limpia los mensajes de WhatsApp: ver askWhatsApp)
import {
  askWhatsApp,
  handleEvent,
  kvStore,
  msgTexto,
  parseWebhook,
  sendMessage,
  TEXTOS,
  verifySignature,
  verifySubscription,
} from "./whatsapp.mjs";

const DEFAULT_ORIGINS = "https://radar.zustrolabs.com";
const DEFAULT_DATA = "https://radar.zustrolabs.com/data/opportunities.json";
const MAX_BODY = 16_000;
const MAX_WA_BODY = 256_000;
const MAX_EDAD_MS = 3600_000; // mensajes de más de 1 h se ignoran (reintentos tardíos o reenvíos de un pedido firmado)

let cache = { at: 0, url: "", db: null };

/** Fichas publicadas (la misma fuente que la web), con caché de 10 minutos por instancia. */
export async function loadDb(env, fetchImpl = fetch, now = Date.now()) {
  const url = env.DATA_URL || DEFAULT_DATA;
  if (cache.db && cache.url === url && now - cache.at < 600_000) return cache.db;
  const res = await fetchImpl(url, { cf: { cacheTtl: 600 } });
  if (!res.ok) throw new Error(`fichas HTTP ${res.status}`);
  const db = await res.json();
  cache = { at: now, url, db };
  return db;
}
export const _resetCache = () => (cache = { at: 0, url: "", db: null });

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (data, status, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });

/** Webhook de WhatsApp: GET = verificación de Meta; POST = mensajes firmados. Responde 200 rápido y procesa aparte. */
async function whatsapp(request, env, ctx, deps) {
  const fetchImpl = deps.fetch ?? fetch;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const v = verifySubscription(url, env);
    return new Response(v.body, {
      status: v.status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "usá POST" }, 405);
  if (!env.WHATSAPP_APP_SECRET || !env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return json({ error: "WhatsApp sin configurar" }, 503);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WA_BODY) return json({ error: "demasiado grande" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_WA_BODY) return json({ error: "demasiado grande" }, 413);
  if (!(await verifySignature(raw, request.headers.get("X-Hub-Signature-256"), env.WHATSAPP_APP_SECRET))) {
    return json({ error: "firma inválida" }, 401);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "pedido inválido" }, 400);
  }
  const events = parseWebhook(payload, env.WHATSAPP_PHONE_NUMBER_ID);
  const work = processEvents(events, env, fetchImpl, deps);
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;
  return json({ ok: true }, 200);
}

async function processEvents(events, env, fetchImpl, deps) {
  const store = deps.store !== undefined ? deps.store : kvStore(env.WA_STATE);
  const ask = deps.ask ?? askWhatsApp(env, fetchImpl);
  const now = deps.now ?? Date.now();
  for (const ev of events) {
    const t0 = Date.now();
    if (!ev.ts || now - ev.ts * 1000 > MAX_EDAD_MS) {
      console.log(JSON.stringify({ canal: "wa", ok: true, que: "viejo" }));
      continue;
    }
    try {
      if (env.LIMITER?.limit) {
        const { success } = await env.LIMITER.limit({ key: `wa:${ev.from}` });
        // Pasado el límite no se contesta nada: responder cada mensaje sería otra forma de abuso.
        if (!success) {
          console.log(JSON.stringify({ canal: "wa", ok: true, que: "limite" }));
          continue;
        }
      }
      const db = await loadDb(env, fetchImpl);
      // Con panel de atención (ZL-65), PERSONA silencia al bot; sin panel, deriva al mail.
      const r = await handleEvent(ev, { db, store, ask, now, panel: env.WHATSAPP_PANEL === "1" });
      for (const m of r.send) await sendMessage(env, m, fetchImpl);
      // Solo métricas: ni el número ni el texto.
      console.log(
        JSON.stringify({
          canal: "wa",
          ok: true,
          ms: Date.now() - t0,
          que: r.metric,
          fichas: r.fichas,
          usage: r.usage,
          handoff: r.handoff,
        }),
      );
    } catch (e) {
      console.log(
        JSON.stringify({ canal: "wa", ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 200) }),
      );
      await sendMessage(env, msgTexto(ev.from, TEXTOS.falla), fetchImpl).catch(() => {});
    }
  }
}

const FALLA = "El asistente no está disponible en este momento. Probá de nuevo en un rato o escribinos por WhatsApp.";

export default {
  async fetch(request, env, ctx, deps = {}) {
    const fetchImpl = deps.fetch ?? fetch;
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const ch = cors(origin, env);

    if (url.pathname === "/health") return json({ ok: true }, 200);
    if (url.pathname === "/whatsapp") return whatsapp(request, env, ctx, deps);
    if (url.pathname !== "/chat") return json({ error: "no existe" }, 404);
    if (request.method === "OPTIONS") return ch ? new Response(null, { status: 204, headers: ch }) : json({}, 403);
    if (request.method !== "POST") return json({ error: "usá POST" }, 405, ch ?? {});
    if (!ch) return json({ error: "origen no permitido" }, 403);

    // Límite por IP (binding de rate limiting de Cloudflare, si está configurado).
    if (env.LIMITER?.limit) {
      const ip = request.headers.get("CF-Connecting-IP") || "anon";
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Muchas preguntas seguidas. Esperá un minuto y probá de nuevo." }, 429, ch);
    }

    let req;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: "mensaje demasiado largo" }, 413, ch);
      req = parseRequest(JSON.parse(text));
    } catch (e) {
      return json({ error: e instanceof SyntaxError ? "pedido inválido" : e.message }, 400, ch);
    }

    const t0 = Date.now();
    try {
      const db = await loadDb(env, fetchImpl);
      const r = await answer(db, req, {
        apiKey: env.ANTHROPIC_API_KEY,
        workspaceId: env.ANTHROPIC_WORKSPACE_ID,
        fetchImpl,
      });
      // Solo métricas, nunca el contenido de la charla.
      console.log(
        JSON.stringify({ ok: true, ms: Date.now() - t0, fichas: r.fichas.length, notes: r.notes, usage: r.usage }),
      );
      return json(
        {
          respuesta: r.respuesta,
          fichas: r.fichas,
          derivar_whatsapp: r.derivar_whatsapp,
          fuera_de_tema: r.fuera_de_tema,
        },
        200,
        ch,
      );
    } catch (e) {
      console.log(JSON.stringify({ ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 200) }));
      return json({ error: FALLA }, 502, ch);
    }
  },
};
