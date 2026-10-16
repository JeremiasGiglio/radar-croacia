// Bot de WhatsApp del Radar (ZL-22): webhook de la Cloud API de Meta en api.zustrolabs.com/whatsapp.
// Usa el mismo cerebro y la misma política que el chat de la web (chat.mjs + policy.mjs).
// Reglas: solo procesa pedidos firmados por Meta; no guarda el texto de los mensajes; la memoria
// (perfil, si atiende una persona) es opcional y depende de ZL-66: sin store, el bot no recuerda nada.

import { answer } from "./chat.mjs";

export const GRAPH_VERSION = "v23.0";
const PERFILES = ["ar", "cit", "res"];

/** Botones del primer mensaje (Meta: hasta 3 botones, título de hasta 20 caracteres). */
export const BOTONES_PERFIL = [
  { id: "perfil_ar", title: "Sin ciudadanía" },
  { id: "perfil_cit", title: "Con ciudadanía" },
  { id: "perfil_res", title: "Vivo en Croacia" },
];

export const TEXTOS = {
  bienvenida:
    "¡Hola! Soy el asistente del Radar Croacia: te ayudo a encontrar oportunidades oficiales de Croacia para descendientes. Respondo con las fichas verificadas del Radar y no doy asesoramiento legal. Para empezar, contame tu situación:",
  aviso: "Escribí PERSONA para hablar con alguien del equipo o BORRAR para que olvidemos tus datos.",
  perfilListo: {
    ar: "Listo: vivís en Argentina y no tenés la ciudadanía croata. ¿Qué estás buscando? Por ejemplo becas, cursos de croata o ayudas para mudarte.",
    cit: "Listo: vivís en Argentina y tenés la ciudadanía croata. ¿Qué estás buscando? Por ejemplo becas, trabajo o ayudas para mudarte.",
    res: "Listo: vivís en Croacia con residencia de diáspora. ¿Qué estás buscando? Por ejemplo ayudas para emprender, cursos o trámites.",
  },
  personaSinMemoria: "Listo, le avisamos al equipo y te va a responder una persona en cuanto pueda.",
  persona:
    "Listo, le avisamos al equipo y te va a responder una persona en cuanto pueda. Mientras tanto, el asistente no contesta en esta charla.",
  borrado:
    "Listo, borramos lo que teníamos de vos (tu perfil y el estado de la charla). Si volvés a escribir, empezamos de cero.",
  soloTexto: "Por ahora solo puedo leer mensajes de texto. Escribime tu pregunta, por favor.",
  muchos: "Son muchas preguntas seguidas. Esperá un minuto y probá de nuevo.",
  falla: "El asistente no está disponible en este momento. Escribí PERSONA y te responde alguien del equipo.",
  derivar: "Si querés que lo vea una persona del equipo, escribí PERSONA.",
};

/** Lo que se agrega al prompt cuando la charla es por WhatsApp. */
export const CANAL_WHATSAPP =
  "Canal: WhatsApp. Ya estás hablando por WhatsApp: nunca digas «escribinos por WhatsApp». Si conviene una persona, poné derivar_whatsapp = true y el sistema le explica cómo pedirla. Cada mensaje llega solo, sin el historial de la charla: si falta contexto, pedilo en una oración.";

// ───────────────────────── Seguridad ─────────────────────────

/** GET de verificación de Meta: devuelve el challenge si el token coincide. */
export function verifySubscription(url, env) {
  const p = url.searchParams;
  if (!env.WHATSAPP_VERIFY_TOKEN) return { status: 503, body: "sin configurar" };
  if (p.get("hub.mode") === "subscribe" && safeEqual(p.get("hub.verify_token") ?? "", env.WHATSAPP_VERIFY_TOKEN)) {
    return { status: 200, body: p.get("hub.challenge") ?? "" };
  }
  return { status: 403, body: "token inválido" };
}

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Firma HMAC-SHA256 del cuerpo crudo, como la manda Meta en X-Hub-Signature-256 («sha256=<hex>»). */
export async function sign(rawBody, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return "sha256=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifySignature(rawBody, header, secret) {
  if (!secret || !header || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  return safeEqual(header.toLowerCase(), await sign(rawBody, secret));
}

// ───────────────────────── Entrada ─────────────────────────

/**
 * Pasa el payload de Meta a eventos simples. Ignora los avisos de estado (enviado, leído) y lo que
 * llegue para otro número de la cuenta.
 * @returns {{id:string, from:string, ts:number, kind:"text"|"perfil"|"otro", text?:string, perfil?:string}[]}
 */
export function parseWebhook(payload, phoneNumberId) {
  if (payload?.object !== "whatsapp_business_account") return [];
  const out = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (change.field !== "messages" || !Array.isArray(v.messages)) continue;
      if (phoneNumberId && v.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const m of v.messages) {
        const base = { id: String(m.id ?? ""), from: String(m.from ?? ""), ts: Number(m.timestamp ?? 0) };
        if (!base.id || !/^\d{6,16}$/.test(base.from)) continue;
        if (m.type === "text") {
          out.push({ ...base, kind: "text", text: String(m.text?.body ?? "") });
        } else if (m.type === "interactive" && m.interactive?.type === "button_reply") {
          const p = /^perfil_(ar|cit|res)$/.exec(m.interactive.button_reply?.id ?? "")?.[1];
          out.push(p ? { ...base, kind: "perfil", perfil: p } : { ...base, kind: "otro" });
        } else if (m.type === "button") {
          // Botón de una plantilla: se trata como texto.
          out.push({ ...base, kind: "text", text: String(m.button?.text ?? "") });
        } else {
          out.push({ ...base, kind: "otro" });
        }
      }
    }
  }
  return out;
}

/** Comandos que no pasan por la IA. */
export function comando(text) {
  const t = String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¡!¿?.]/g, "");
  if (/^(borrar|borra|olvidame|eliminar mis datos)$/.test(t)) return "borrar";
  if (/^(persona|humano|hablar con (una )?persona|operador|agente)$/.test(t)) return "persona";
  if (/^(perfil|cambiar perfil)$/.test(t)) return "perfil";
  return null;
}

// ───────────────────────── Salida ─────────────────────────

export const msgTexto = (to, body) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "text",
  text: { preview_url: false, body: String(body).slice(0, 4096) },
});

export const msgBotones = (to, body) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "interactive",
  interactive: {
    type: "button",
    body: { text: String(body).slice(0, 1024) },
    action: { buttons: BOTONES_PERFIL.map((b) => ({ type: "reply", reply: b })) },
  },
});

/** Respuesta de la IA → texto de WhatsApp. Los links son solo los oficiales de cada ficha (no los escribe la IA). */
export function formatAnswer(r) {
  const parts = [r.respuesta];
  if (r.fichas?.length) {
    parts.push(r.fichas.map((f) => `- ${f.t}\n  Fuente oficial: ${f.src?.[1] ?? f.src?.[0] ?? ""}`).join("\n"));
  }
  if (r.derivar_whatsapp && !r.fuera_de_tema) parts.push(TEXTOS.derivar);
  return parts.filter(Boolean).join("\n\n");
}

/** Manda un mensaje con la Cloud API. */
export async function sendMessage(env, message, fetchImpl = fetch) {
  const v = env.WHATSAPP_GRAPH_VERSION || GRAPH_VERSION;
  const res = await fetchImpl(`https://graph.facebook.com/${v}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp ${res.status}: ${data?.error?.message ?? "sin detalle"}`);
  }
}

// ───────────────────────── Memoria ─────────────────────────

/**
 * Memoria por número (ZL-66). Guarda solo {perfil, humanoHasta, visto}: nunca el texto.
 * Sin binding de KV devuelve un store vacío: el bot no recuerda y no pregunta el perfil.
 */
export function kvStore(kv, ttlSeconds = 90 * 24 * 3600) {
  if (!kv) return null;
  return {
    get: async (n) => (await kv.get(`wa:${n}`, "json")) ?? null,
    put: (n, data) => kv.put(`wa:${n}`, JSON.stringify(data), { expirationTtl: ttlSeconds }),
    delete: (n) => kv.delete(`wa:${n}`),
    seen: async (id) => {
      // Meta reintenta: un mismo mensaje no se responde dos veces.
      if (await kv.get(`wamid:${id}`)) return true;
      await kv.put(`wamid:${id}`, "1", { expirationTtl: 3600 });
      return false;
    },
  };
}

/** Store en memoria para tests y para desarrollo local. */
export function memoryStore() {
  const m = new Map();
  const ids = new Set();
  return {
    _data: m,
    get: async (n) => m.get(n) ?? null,
    put: async (n, d) => void m.set(n, d),
    delete: async (n) => void m.delete(n),
    seen: async (id) => (ids.has(id) ? true : (ids.add(id), false)),
  };
}

// ───────────────────────── Lógica ─────────────────────────

const HORAS_PERSONA = 24;

/**
 * Decide qué contestar a un evento. Devuelve los mensajes a mandar y métricas (sin texto).
 * deps: {db, store, ask(db, req) → respuesta del chat, now}
 */
export async function handleEvent(ev, { db, store, ask, now = Date.now() }) {
  if (store && (await store.seen(ev.id))) return { send: [], metric: "repetido" };
  const state = (store && (await store.get(ev.from))) || null;
  const save = (s) => store?.put(ev.from, s);
  const cmd = ev.kind === "text" ? comando(ev.text) : null;

  if (cmd === "borrar") {
    await store?.delete(ev.from);
    return { send: [msgTexto(ev.from, TEXTOS.borrado)], metric: "borrar" };
  }

  // Si atiende una persona, el bot no contesta (salvo BORRAR) hasta que se devuelva o pasen 24 h.
  if (state?.humanoHasta && state.humanoHasta > now) return { send: [], metric: "humano" };

  if (cmd === "persona") {
    if (!store) return { send: [msgTexto(ev.from, TEXTOS.personaSinMemoria)], metric: "persona", handoff: true };
    await save({ ...state, humanoHasta: now + HORAS_PERSONA * 3600_000, visto: now });
    return { send: [msgTexto(ev.from, TEXTOS.persona)], metric: "persona", handoff: true };
  }

  if (ev.kind === "perfil") {
    await save({ ...state, perfil: ev.perfil, humanoHasta: 0, visto: now });
    return { send: [msgTexto(ev.from, TEXTOS.perfilListo[ev.perfil])], metric: "perfil" };
  }

  if (ev.kind === "otro") return { send: [msgTexto(ev.from, TEXTOS.soloTexto)], metric: "otro" };

  // Primer contacto (solo si hay memoria) o pedido de cambiar el perfil: botones.
  if (store && (!state?.perfil || cmd === "perfil")) {
    await save({ ...state, humanoHasta: 0, visto: now });
    const body = cmd === "perfil" ? "Contame tu situación:" : `${TEXTOS.bienvenida}\n\n${TEXTOS.aviso}`;
    return { send: [msgBotones(ev.from, body)], metric: "bienvenida" };
  }

  const text = String(ev.text ?? "").trim();
  if (!text) return { send: [msgTexto(ev.from, TEXTOS.soloTexto)], metric: "vacio" };

  const perfil = PERFILES.includes(state?.perfil) ? state.perfil : "ar";
  const r = await ask(db, { messages: [{ role: "user", content: text.slice(0, 800) }], perfil });
  if (state) await save({ ...state, visto: now });
  return { send: [msgTexto(ev.from, formatAnswer(r))], metric: "ia", fichas: r.fichas.length, usage: r.usage };
}

/** Respuesta del chat con el aviso de canal (lo usa el Worker; en los tests se reemplaza). */
export const askWhatsApp = (env, fetchImpl) => (db, req) =>
  answer(db, req, {
    apiKey: env.ANTHROPIC_API_KEY,
    workspaceId: env.ANTHROPIC_WORKSPACE_ID,
    fetchImpl,
    canal: CANAL_WHATSAPP,
  });
