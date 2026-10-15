// Controles deterministas sobre la salida de la IA. La regla: la IA nunca inventa montos ni plazos.
// Si algo no se puede comprobar contra el texto de la fuente, se borra y queda una nota para revisar.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
const digits = (s) => String(s ?? "").replace(/\D/g, "");

// Raíces de los meses en croata (nominativo y genitivo): siječanj/siječnja, veljača/veljače…
const MONTHS_HR = [
  "siječ",
  "veljač",
  "ožuj",
  "trav",
  "svib",
  "lip",
  "srp",
  "kolovoz",
  "ruj",
  "listopad",
  "studen",
  "prosin",
];

/** ¿La cita aparece textual en la fuente (ignorando mayúsculas y espacios)? */
export function quoteInSource(quote, source) {
  const q = norm(quote);
  return q.length >= 4 && norm(source).includes(q);
}

/** Números de un texto, en formato croata/rioplatense (1.800.000,00 → "1800000"; se ignoran los decimales). */
export function numbersIn(s) {
  return [...String(s ?? "").matchAll(/\d+(?:[.\s\u00A0]\d{3})*(?:,\d+)?/g)].map((m) => digits(m[0].split(",")[0]));
}

/** Cada cifra del monto tiene que estar en la cita (1.800.000 EUR ↔ «1.800.000,00 EUR»). */
export function amountMatchesQuote(amount, quote) {
  const wanted = numbersIn(amount);
  if (!wanted.length) return false;
  const have = new Set(numbersIn(quote));
  return wanted.every((n) => have.has(n));
}

/** La fecha AAAA-MM-DD tiene que salir de la cita: mismo día, mismo mes (número o nombre croata) y año si figura. */
export function dateMatchesQuote(date, quote) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  if (!m) return false;
  const [, y, mo, d] = m;
  const q = norm(quote);
  const day = String(Number(d));
  const month = Number(mo);
  const hasDay = new RegExp(`(^|\\D)0?${day}\\s*\\.`).test(q);
  const hasMonth = q.includes(MONTHS_HR[month - 1]) || new RegExp(`\\.\\s*0?${month}\\s*\\.`).test(q);
  const years = q.match(/\b(19|20)\d{2}\b/g);
  const hasYear = !years || years.includes(y);
  return hasDay && hasMonth && hasYear;
}

const URL_RE = /https?:\/\/[^\s)»"]+/gi;

/**
 * Aplica los controles y devuelve { draft, notes }. No modifica el original.
 * @param {any} raw salida del modelo (ya validada contra el esquema)
 * @param {string} source texto de la fuente que vio el modelo
 */
export function applyGuardrails(raw, source) {
  const draft = structuredClone(raw);
  const notes = [];

  if (draft.amount != null) {
    const ok =
      draft.amount_cita != null &&
      quoteInSource(draft.amount_cita, source) &&
      amountMatchesQuote(draft.amount, draft.amount_cita);
    if (!ok) {
      notes.push(
        `Se borró el monto «${draft.amount}»: no aparece textual en la fuente. Revisar el PDF de la convocatoria.`,
      );
      draft.amount = null;
      draft.amount_cita = null;
    }
  } else draft.amount_cita = null;

  if (draft.deadline != null) {
    const ok =
      draft.deadline_cita != null &&
      quoteInSource(draft.deadline_cita, source) &&
      dateMatchesQuote(draft.deadline, draft.deadline_cita);
    if (!ok) {
      notes.push(`Se borró el plazo «${draft.deadline}»: no coincide con una fecha textual de la fuente.`);
      draft.deadline = null;
      draft.deadline_cita = null;
    }
  } else draft.deadline_cita = null;

  // Links: solo se aceptan los que están en la fuente (defensa contra instrucciones escondidas).
  const src = norm(source);
  for (const key of ["t", "who", "what", "motivo_relevancia"]) {
    draft[key] = String(draft[key] ?? "").replace(URL_RE, (u) => {
      if (src.includes(norm(u))) return u;
      notes.push(`Se sacó un link que no está en la fuente: ${u}`);
      return "";
    });
  }
  for (const p of ["ar", "cit", "res"]) {
    const e = draft.el?.[p];
    if (!e) continue;
    e.motivo = String(e.motivo ?? "").replace(URL_RE, "");
    // Conservador: «ok» sin motivo pasa a «cond».
    if (e.estado === "ok" && e.motivo.trim().length < 5) {
      e.estado = "cond";
      notes.push(`Perfil ${p}: «ok» sin motivo, se pasó a «cond».`);
    }
  }
  return { draft, notes };
}

/** Offset de Zagreb para una fecha (+01:00 en invierno, +02:00 en verano). */
export function zagrebOffset(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zagreb", timeZoneName: "longOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d{2}:\d{2})/.exec(part ?? "");
  return m ? m[1] : "+01:00";
}

/** Borrador del modelo → forma de ficha de site/data/opportunities.json (sin coordenadas ni verificación). */
export function toFicha(draft, item, notes = []) {
  const host = new URL(item.link).hostname.replace(/^www\./, "");
  const ficha = {
    cat: draft.cat,
    t: draft.t,
    t_hr: draft.t_hr,
    who: draft.who,
    amount: draft.amount ?? "",
    what: draft.what,
    el: {
      ar: [draft.el.ar.estado, draft.el.ar.motivo],
      cit: [draft.el.cit.estado, draft.el.cit.motivo],
      res: [draft.el.res.estado, draft.el.res.motivo],
    },
    src: [host, item.link],
    ai_generated: true,
  };
  if (draft.deadline) ficha.deadline = `${draft.deadline}T23:59:00${zagrebOffset(draft.deadline)}`;
  const flags = [...(draft.notas_revision ?? []), ...notes];
  if (flags.length) ficha.flag = flags.join(" ");
  return ficha;
}
