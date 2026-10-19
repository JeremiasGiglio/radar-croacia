// Bot de WhatsApp del Radar (ZL-22): webhook de la Cloud API de Meta en api.zustrolabs.com/whatsapp.
// Usa el mismo cerebro y la misma política que el chat de la web (chat.mjs + policy.mjs).
// Reglas: solo procesa pedidos firmados por Meta; no guarda el texto de las charlas con el bot; la memoria
// (perfil, si atiende una persona) es opcional y depende de ZL-66: sin store, el bot no recuerda nada.
// Excepción (ZL-65): si la persona escribe PERSONA y el panel está activo, se guardan sus mensajes 30 días
// para que el equipo los lea y responda en atencion.zustrolabs.com.

import { agregar } from "./atencion.mjs";
import { answer, parseRequest } from "./chat.mjs";
import {
  BOTON_IDIOMA,
  IDIOMA_PROMPT,
  IDIOMAS,
  idiomaDe,
  NOMBRE_IDIOMA,
  SALUDO_IDIOMA,
  SECCION_IDIOMA,
  TEXTOS_I18N,
  textos,
} from "./textos.mjs";

export const GRAPH_VERSION = "v25.0";
const PERFILES = ["ar", "cit", "res"];
const IDS_PERFIL = ["perfil_ar", "perfil_cit", "perfil_res"];

/** Botones de perfil en el idioma de la charla (Meta: hasta 3 botones, título de hasta 20 caracteres). */
export const botonesPerfil = (idioma = "es") =>
  textos(idioma).botones.map((title, i) => ({ id: IDS_PERFIL[i], title }));
export const BOTONES_PERFIL = botonesPerfil("es");

/** Textos en castellano (compatibilidad); cada idioma está en textos.mjs. */
export const TEXTOS = TEXTOS_I18N.es;
export { IDIOMAS, TEXTOS_I18N };

/** Lo que se agrega al prompt cuando la charla es por WhatsApp. */
export const CANAL_WHATSAPP =
  "Canal: WhatsApp. Ya estás hablando por WhatsApp: nunca digas «escribinos por WhatsApp». Si conviene una persona, poné derivar_whatsapp = true y el sistema le explica cómo pedirla. Cada mensaje llega solo, sin el historial de la charla: si falta contexto, pedilo en una oración.";

/** Aviso de canal + idioma elegido (ZL-78). En castellano queda igual que antes. */
export function canalWhatsApp(idioma = "es") {
  const i = idiomaDe(idioma);
  if (i === "es") return CANAL_WHATSAPP;
  return `${CANAL_WHATSAPP}\nIdioma elegido por la persona: ${IDIOMA_PROMPT[i]}. Respondé en ese idioma (el catálogo está en castellano: traducilo). Los nombres oficiales van en croata. Si la persona te escribe claramente en otro idioma, respondé en el idioma en que escribe.`;
}

// ───────────────────────── Seguridad ─────────────────────────

/** GET de verificación de Meta: devuelve el challenge si el token coincide. */
export function verifySubscription(url, env) {
  const p = url.searchParams;
  if (!env.WHATSAPP_VERIFY_TOKEN) return { status: 503, body: "sin configurar" };
  if (p.get("hub.mode") === "subscribe" && safeEqual(p.get("hub.verify_token") ?? "", env.WHATSAPP_VERIFY_TOKEN)) {
    // Solo se devuelve un challenge con forma de challenge (Meta manda números): nada de reflejar texto arbitrario.
    const ch = p.get("hub.challenge") ?? "";
    return /^[A-Za-z0-9_-]{1,128}$/.test(ch) ? { status: 200, body: ch } : { status: 400, body: "challenge inválido" };
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
 * @returns {{id:string, from:string, ts:number, kind:"text"|"perfil"|"idioma"|"otro", text?:string, perfil?:string, idioma?:string}[]}
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
        } else if (m.type === "interactive" && m.interactive?.type === "list_reply") {
          const i = /^idioma_(es|hr|en|pt)$/.exec(m.interactive.list_reply?.id ?? "")?.[1];
          out.push(i ? { ...base, kind: "idioma", idioma: i } : { ...base, kind: "otro" });
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¡!¿?.,;:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Castellano, croata, inglés y portugués (ZL-78). Solo el mensaje entero: «borrar mi duda» no es un comando.
  if (
    /^(borrar|borra|olvidame|eliminar mis datos|obrisi|obrisi me|zaboravi me|delete|delete my data|forget me|apagar|apagar meus dados|esqueca me|esquecer)$/.test(
      t,
    )
  )
    return "borrar";
  if (
    /^(persona|humano|hablar con (una )?persona|operador|agente|osoba|covjek|razgovor s osobom|operater|person|human|agent|talk to a person|operator|pessoa|atendente|falar com uma pessoa)$/.test(
      t,
    )
  )
    return "persona";
  if (/^(perfil|cambiar perfil|profil|promijeni profil|profile|change profile|mudar perfil)$/.test(t)) return "perfil";
  if (/^(idioma|cambiar idioma|jezik|promijeni jezik|language|change language|lingua|mudar idioma)$/.test(t))
    return "idioma";
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

export const msgBotones = (to, body, idioma = "es") => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "interactive",
  interactive: {
    type: "button",
    body: { text: String(body).slice(0, 1024) },
    action: { buttons: botonesPerfil(idioma).map((b) => ({ type: "reply", reply: b })) },
  },
});

/** Lista para elegir idioma (4 opciones: más de 3, por eso es lista y no botones). */
export const msgIdiomas = (to) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "interactive",
  interactive: {
    type: "list",
    body: { text: SALUDO_IDIOMA },
    action: {
      button: BOTON_IDIOMA,
      sections: [{ title: SECCION_IDIOMA, rows: IDIOMAS.map((i) => ({ id: `idioma_${i}`, title: NOMBRE_IDIOMA[i] })) }],
    },
  },
});

/** Respuesta de la IA → texto de WhatsApp. Los links son solo los oficiales de cada ficha (no los escribe la IA). */
export function formatAnswer(r, idioma = "es") {
  const T = textos(idioma);
  const parts = [r.respuesta];
  if (r.fichas?.length) {
    parts.push(
      r.fichas
        .map((f) => {
          // Solo links https de la propia ficha; nunca uno escrito por la IA.
          const link = /^https:\/\/\S+$/.test(f.src?.[1] ?? "") ? f.src[1] : "";
          return link ? `- ${f.t}\n  ${T.fuente}: ${link}` : `- ${f.t}`;
        })
        .join("\n"),
    );
  }
  if (r.derivar_whatsapp && !r.fuera_de_tema) parts.push(T.derivar);
  return parts.filter(Boolean).join("\n\n");
}

/** Manda un mensaje con la Cloud API. */
/**
 * Celulares de Argentina: WhatsApp los informa como 549 + área + número, pero la API a veces solo acepta
 * la otra forma (sin el 9, o al revés). Devuelve la variante a probar, o null si no es un celular argentino.
 */
export function variantArgentina(to) {
  const n = String(to ?? "");
  if (/^549\d{10}$/.test(n)) return "54" + n.slice(3);
  if (/^54\d{10}$/.test(n)) return "549" + n.slice(2);
  return null;
}

async function postMessage(env, message, fetchImpl) {
  const v = env.WHATSAPP_GRAPH_VERSION || GRAPH_VERSION;
  const res = await fetchImpl(`https://graph.facebook.com/${v}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, code: data?.error?.code, message: data?.error?.message ?? "sin detalle" };
}

/** Manda un mensaje con la Cloud API. Si Meta rechaza un celular argentino (#131030), prueba la otra forma. */
export async function sendMessage(env, message, fetchImpl = fetch) {
  let err = await postMessage(env, message, fetchImpl);
  const alt = variantArgentina(message.to);
  if (err && err.code === 131030 && alt) {
    err = await postMessage(env, { ...message, to: alt }, fetchImpl);
  }
  if (err) throw new Error(`WhatsApp ${err.status}: ${err.message}`);
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

/** Cómo queda en el panel un mensaje que no es texto. */
const notaNoTexto = (ev) =>
  ev.kind === "perfil"
    ? "[Tocó un botón de perfil]"
    : ev.kind === "idioma"
      ? "[Eligió idioma]"
      : "[Mandó algo que no es texto: audio, foto o archivo]";

/**
 * Decide qué contestar a un evento. Devuelve los mensajes a mandar y métricas (sin texto).
 * deps: {db, store, ask(db, req, {idioma}) → respuesta del chat, now, panel, chats}
 * chats (ZL-65): charlas con atención humana; solo se usa con panel activo.
 * Idioma (ZL-78): en el primer contacto se pregunta con una lista; se guarda con el perfil.
 */
export async function handleEvent(ev, { db, store, ask, now = Date.now(), panel = false, chats = null }) {
  if (store && (await store.seen(ev.id))) return { send: [], metric: "repetido" };
  const state = (store && (await store.get(ev.from))) || null;
  const save = (s) => store?.put(ev.from, s);
  const cmd = ev.kind === "text" ? comando(ev.text) : null;
  const conPanel = panel && store && chats;
  const idioma = idiomaDe(state?.idioma);
  const T = textos(idioma);

  if (cmd === "borrar") {
    await store?.delete(ev.from);
    await chats?.delete(ev.from);
    return { send: [msgTexto(ev.from, T.borrado)], metric: "borrar" };
  }

  // Si atiende una persona, el bot no contesta (salvo BORRAR) hasta que se devuelva o pasen 24 h.
  // Con panel, el mensaje queda en la charla para el equipo y la ventana de 24 h se renueva.
  if (state?.humanoHasta && state.humanoHasta > now) {
    if (conPanel) {
      const texto = ev.kind === "text" ? String(ev.text ?? "").trim() || "[Mensaje vacío]" : notaNoTexto(ev);
      await agregar(chats, ev.from, { de: "persona", texto }, now, { abierta: true });
      await save({ ...state, humanoHasta: now + HORAS_PERSONA * 3600_000, visto: now });
    }
    return { send: [], metric: "humano" };
  }

  if (cmd === "persona") {
    if (!panel) return { send: [msgTexto(ev.from, T.personaMail)], metric: "persona", handoff: true };
    if (!store) return { send: [msgTexto(ev.from, T.personaSinMemoria)], metric: "persona", handoff: true };
    await save({ ...state, humanoHasta: now + HORAS_PERSONA * 3600_000, visto: now });
    if (chats) {
      // Se abre la charla en el panel. El texto «PERSONA» cuenta como su último mensaje (ventana de 24 h).
      await agregar(chats, ev.from, { de: "persona", texto: String(ev.text ?? "PERSONA").trim() }, now, {
        abierta: true,
        idioma,
      });
      await agregar(
        chats,
        ev.from,
        {
          de: "sistema",
          texto: `Pidió hablar con una persona. El bot está en pausa. Idioma: ${NOMBRE_IDIOMA[idioma]}.`,
        },
        now,
      );
    }
    return { send: [msgTexto(ev.from, T.persona)], metric: "persona", handoff: true, notify: Boolean(chats) };
  }

  if (ev.kind === "idioma") {
    const nuevo = idiomaDe(ev.idioma);
    const N = textos(nuevo);
    await save({ ...state, idioma: nuevo, humanoHasta: 0, visto: now });
    // Con perfil ya elegido solo se confirma; si no, bienvenida y botones de perfil en ese idioma.
    if (PERFILES.includes(state?.perfil)) return { send: [msgTexto(ev.from, N.idiomaCambiado)], metric: "idioma" };
    return { send: [msgBotones(ev.from, `${N.bienvenida}\n\n${N.aviso}`, nuevo)], metric: "idioma" };
  }

  if (cmd === "idioma" && store) return { send: [msgIdiomas(ev.from)], metric: "pide_idioma" };

  if (ev.kind === "perfil") {
    await save({ ...state, perfil: ev.perfil, humanoHasta: 0, visto: now });
    return { send: [msgTexto(ev.from, T.perfilListo[ev.perfil])], metric: "perfil" };
  }

  if (ev.kind === "otro") return { send: [msgTexto(ev.from, T.soloTexto)], metric: "otro" };

  // Primer contacto (solo con memoria): lista de idiomas. Si ya la vio y escribió igual, sigue en castellano.
  if (store && !state) {
    await save({ humanoHasta: 0, visto: now });
    return { send: [msgIdiomas(ev.from)], metric: "pide_idioma" };
  }

  // Sin perfil o pedido de cambiarlo: botones.
  if (store && (!state?.perfil || cmd === "perfil")) {
    await save({ ...state, humanoHasta: 0, visto: now });
    const body = cmd === "perfil" ? T.perfilPedir : `${T.bienvenida}\n\n${T.aviso}`;
    return { send: [msgBotones(ev.from, body, idioma)], metric: "bienvenida" };
  }

  const text = String(ev.text ?? "").trim();
  if (!text) return { send: [msgTexto(ev.from, T.soloTexto)], metric: "vacio" };

  const perfil = PERFILES.includes(state?.perfil) ? state.perfil : "ar";
  // Misma limpieza que el chat de la web: sin caracteres de control y hasta 800 caracteres.
  const r = await ask(db, parseRequest({ messages: [{ role: "user", content: text }], perfil }), { idioma });
  if (state) await save({ ...state, visto: now });
  return {
    send: [msgTexto(ev.from, formatAnswer(r, idioma))],
    metric: "ia",
    idioma,
    fichas: r.fichas.length,
    usage: r.usage,
  };
}

/** Respuesta del chat con el aviso de canal y el idioma (lo usa el Worker; en los tests se reemplaza). */
export const askWhatsApp =
  (env, fetchImpl) =>
  (db, req, { idioma = "es" } = {}) =>
    answer(db, req, {
      apiKey: env.ANTHROPIC_API_KEY,
      workspaceId: env.ANTHROPIC_WORKSPACE_ID,
      fetchImpl,
      canal: canalWhatsApp(idioma),
      whatsapp: true,
      idioma,
    });
