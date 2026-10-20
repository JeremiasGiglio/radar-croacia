// Lógica del chat del Radar (sin dependencias: corre igual en Cloudflare Workers y en Node para los tests).
// Reglas: responde solo con las fichas verificadas; nunca inventa montos; no guarda mensajes.

import { textos } from "./textos.mjs";
import { LIMITES, reglasParaModelo } from "./policy.mjs";

export const MODEL = "claude-haiku-5-5";
export const LIMITS = {
  turns: LIMITES.turnos,
  chars: LIMITES.mensaje,
  answer: LIMITES.respuesta,
  fichas: LIMITES.fichas,
};
const PROFILES_FALLBACK = {
  ar: "Vive en Argentina, sin ciudadanía",
  cit: "Vive en Argentina, con ciudadanía",
  res: "Vive en Croacia con residencia de diáspora",
};

const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** Catálogo compacto de fichas para el modelo (es DATO). */
export function buildCatalog(db, today = new Date()) {
  const t = today.toISOString().slice(0, 10);
  const ops = (db.opportunities ?? []).map((o) => {
    const closed = o.deadline && o.deadline.slice(0, 10) < t;
    return [
      `[${o.id}] ${o.t}`,
      `  categoría: ${db.categories?.[o.cat]?.n ?? o.cat} · quién: ${o.who}` +
        ` · ${o.abierta ? "abierta a todos (no pide ascendencia croata)" : "pide ascendencia o ciudadanía croata"}`,
      `  monto: ${o.amount || "sin dato"}`,
      `  plazo: ${o.deadline ? fmtDate(o.deadline) + (closed ? " (CERRADA)" : " (abierta)") : "sin fecha fija"}` +
        (o.next ? ` · próxima edición: ${o.next}` : ""),
      `  qué es: ${o.what}`,
      `  elegibilidad: ar=${o.el.ar[0]} (${o.el.ar[1]}) · cit=${o.el.cit[0]} (${o.el.cit[1]}) · res=${o.el.res[0]} (${o.el.res[1]})`,
      o.flag ? `  ojo: ${o.flag}` : null,
      `  fuente (${db.fuentes?.[o.fuente] ?? o.fuente ?? "oficial"}): ${o.src[1]} · revisada: ${fmtDate(o.verified_at)}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const events = (db.events ?? []).map((e) => `- ${e.date}: ${e.t}, ${e.where}. ${e.note}`);
  return `FICHAS (${ops.length}):\n${ops.join("\n\n")}\n\nEVENTOS:\n${events.join("\n")}`;
}

export function systemPrompt(db, today = new Date(), canal = "") {
  const P = db.profiles ?? PROFILES_FALLBACK;
  return `Sos el asistente del Radar Croacia (radar.zustrolabs.com), un sitio gratuito de Zustro Labs que reúne en castellano programas, becas y oportunidades en Croacia para la diáspora sudamericana y para quien quiera ir a Croacia. Hoy es ${fmtDate(today.toISOString())}.

Tu trabajo: ayudar a la persona a encontrar qué fichas del catálogo le sirven según su situación, y explicarlas simple.

Perfiles: ar = ${P.ar}; cit = ${P.cit}; res = ${P.res}. El perfil que eligió la persona viene en cada pedido; si en la charla dice otra cosa sobre su situación, usá lo que dice.

${reglasParaModelo()}
${canal ? `\n${canal}\n` : ""}
${buildCatalog(db, today)}`;
}

export const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["respuesta", "fichas", "derivar_whatsapp", "fuera_de_tema"],
  properties: {
    respuesta: { type: "string", description: "Respuesta para mostrar, en castellano rioplatense, 2 a 5 oraciones." },
    fichas: { type: "array", items: { type: "string" }, description: "Ids de fichas recomendadas, de 0 a 4." },
    derivar_whatsapp: { type: "boolean", description: "true si conviene hablar con una persona." },
    fuera_de_tema: { type: "boolean", description: "true si el pedido no es sobre el Radar." },
  },
};

/** Valida y limpia el pedido del navegador. Devuelve {messages, perfil} o tira Error con mensaje para mostrar. */
export function parseRequest(body) {
  if (!body || typeof body !== "object") throw new Error("pedido inválido");
  const perfil = ["ar", "cit", "res"].includes(body.perfil) ? body.perfil : "ar";
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!raw.length) throw new Error("falta el mensaje");
  const messages = raw
    .slice(-LIMITS.turns)
    .map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content ?? "")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F]/g, "")
        .trim()
        .slice(0, LIMITS.chars),
    }))
    .filter((m) => m.content);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") throw new Error("el último mensaje tiene que ser tuyo");
  // La API pide turnos alternados: se juntan los mensajes seguidos del mismo rol.
  const merged = [];
  for (const m of messages) {
    if (merged.length && merged.at(-1).role === m.role) merged.at(-1).content += "\n" + m.content;
    else merged.push({ ...m });
  }
  return { messages: merged, perfil };
}

export function buildRequest(db, { messages, perfil }, { today = new Date(), maxTokens = 3000, canal = "" } = {}) {
  const P = db.profiles ?? PROFILES_FALLBACK;
  const last = messages.at(-1);
  const withProfile = [
    ...messages.slice(0, -1),
    { role: "user", content: `[Perfil elegido en la página: ${perfil} = ${P[perfil]}]\n${last.content}` },
  ];
  return {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt(db, today, canal),
    messages: withProfile,
    output_config: { format: { type: "json_schema", schema: CHAT_SCHEMA } },
  };
}

/** Validación mínima de la salida (sin ajv: en Workers no se puede compilar código). */
export function validateAnswer(a) {
  return (
    a &&
    typeof a === "object" &&
    typeof a.respuesta === "string" &&
    Array.isArray(a.fichas) &&
    a.fichas.every((x) => typeof x === "string") &&
    typeof a.derivar_whatsapp === "boolean" &&
    typeof a.fuera_de_tema === "boolean"
  );
}

const NUM = String.raw`\d+(?:[.,\s\u00A0]\d{3})*(?:,\d+)?`;
// Monedas en castellano, croata, inglés y portugués (ZL-78): «€», «euros», «eura», «dollars», «kuna», «reais»…
const CUR = String.raw`(?:€|eur(?:o|os|a)?\b|usd|us\$|d[oó]lares|dollars?|dolara|kun[aei]\b|kn\b|reais|r\$)`;
const MIL = String.raw`(?:mil|tisuća|tisuće|thousand)`;
const MONEY_RE = new RegExp(String.raw`${CUR}\s*(${NUM})|(${NUM})\s*(?:${MIL}\s+)?${CUR}`, "gi");
// «1.050», «1,050» y «1 050» son mil cincuenta; «400,50» es cuatrocientos con cincuenta.
const intPart = (n) =>
  /^\d{1,3}(?:[.,\s\u00A0]\d{3})+$/.test(String(n))
    ? String(n).replace(/\D/g, "")
    : String(n).split(",")[0].replace(/\D/g, "");
const numbersIn = (s) => [...String(s ?? "").matchAll(new RegExp(NUM, "g"))].map((m) => intPart(m[0]));
/** Cifras de plata de un texto: «€400», «400 euros», «30 mil euros» (este último nunca coincide: se descarta). */
export const moneyIn = (s) =>
  [...String(s ?? "").matchAll(MONEY_RE)].map(
    (m) => intPart(m[1] ?? m[2]) + (new RegExp(String.raw`${MIL}\s`, "i").test(m[0]) ? "k" : ""),
  );

/** Texto plano: saca negritas, títulos, viñetas y código de markdown, conservando los saltos de línea. */
export function stripMarkdown(s) {
  return String(s ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

/**
 * Controles deterministas sobre la respuesta:
 * - solo ids de fichas que existen (máximo 4);
 * - sin links (la página muestra la fuente oficial de cada ficha);
 * - cada oración que habla de plata tiene que usar cifras que estén en el monto de alguna ficha; si no, se saca.
 */
export function applyGuardrails(answer, db, { whatsapp = false, idioma = "es" } = {}) {
  const T = textos(idioma);
  const byId = new Map((db.opportunities ?? []).map((o) => [o.id, o]));
  const notes = [];
  const fichas = [...new Set(answer.fichas)].filter((id) => byId.has(id)).slice(0, LIMITS.fichas);
  if (fichas.length !== new Set(answer.fichas).size) notes.push("ids desconocidos descartados");

  let text = stripMarkdown(String(answer.respuesta))
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[ \t]{2,}/g, " ");
  const known = new Set((db.opportunities ?? []).flatMap((o) => numbersIn(o.amount)));
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const ok = moneyIn(s).every((n) => known.has(n));
    if (!ok) notes.push("se sacó una cifra que no está en las fichas");
    return ok;
  });
  // Por WhatsApp no se dice «escribinos por WhatsApp» ni «una persona por WhatsApp» (ZL-76): se saca la oración
  // y, en su lugar, el bot agrega cómo pedir una persona (PERSONA) en el idioma de la charla.
  let derivar = answer.derivar_whatsapp;
  const final = whatsapp
    ? kept.filter((s) => {
        const habla = /whats\s?app/i.test(s);
        if (habla) {
          notes.push("se sacó una mención a WhatsApp");
          derivar = true;
        }
        return !habla;
      })
    : kept;
  text = final.join(" ").trim();
  if (kept.length !== sentences.length)
    text += " " + (whatsapp ? T.montos : "Para montos exactos, mirá la ficha oficial.");
  if (text.length > LIMITS.answer) text = text.slice(0, LIMITS.answer).replace(/\s+\S*$/, "") + "…";
  text = text.trim();
  let sinTexto = false;
  if (!text) {
    sinTexto = true;
    text = whatsapp
      ? T.sinRespuesta
      : "No tengo una respuesta segura para eso. Si querés, escribinos por WhatsApp y te ayuda una persona.";
  }

  return {
    respuesta: text,
    fichas: fichas.map((id) => ({ id, t: byId.get(id).t, src: byId.get(id).src })),
    // Sin fichas, se ofrece una persona; salvo que el pedido sea ajeno al Radar.
    // Por WhatsApp, el texto de «sin respuesta» ya dice cómo pedir una persona: no se repite.
    derivar_whatsapp: whatsapp && sinTexto ? false : derivar || (fichas.length === 0 && !answer.fuera_de_tema),
    fuera_de_tema: answer.fuera_de_tema,
    notes,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Llama a la API de Claude y devuelve la respuesta ya validada y controlada. */
export async function answer(
  db,
  req,
  { apiKey, workspaceId, fetchImpl = fetch, today = new Date(), canal = "", whatsapp = false, idioma = "es" } = {},
) {
  if (!apiKey) throw new Error("falta ANTHROPIC_API_KEY");
  const body = JSON.stringify(buildRequest(db, req, { today, canal }));
  let res, data;
  for (let attempt = 1; attempt <= 2; attempt++) {
    res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(workspaceId ? { "anthropic-workspace-id": workspaceId } : {}),
      },
      body,
      // Si la IA no responde en 25 s se corta: el Worker no queda colgado y la persona recibe el aviso de falla.
      signal: AbortSignal.timeout(25_000),
    });
    data = await res.json().catch(() => ({}));
    if (res.ok) break;
    if (![429, 500, 502, 503, 529].includes(res.status) || attempt === 2) {
      throw new Error(`API ${res.status}: ${data?.error?.message ?? "sin detalle"}`);
    }
    await sleep(1500);
  }
  if (data.stop_reason === "refusal") throw new Error("el modelo no quiso responder");
  if (data.stop_reason === "max_tokens") throw new Error("respuesta cortada");
  let parsed;
  try {
    parsed = JSON.parse((data.content ?? []).find((b) => b.type === "text")?.text ?? "");
  } catch {
    throw new Error("la respuesta no es JSON");
  }
  if (!validateAnswer(parsed)) throw new Error("la respuesta no cumple el esquema");
  return { ...applyGuardrails(parsed, db, { whatsapp, idioma }), usage: data.usage ?? {} };
}
