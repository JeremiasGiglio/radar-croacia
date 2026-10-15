// Genera docs/07_politica_chat.md y site/asistente.html desde worker/src/policy.mjs.
// Uso: npm run policy   ·   Los tests fallan si alguno de los dos quedó desactualizado.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { POLITICA, LIMITES } from "../worker/src/policy.mjs";

const ROOT = new URL("..", import.meta.url);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const limites = [
  `Cada mensaje: hasta ${LIMITES.mensaje} caracteres.`,
  `Se tienen en cuenta los últimos ${LIMITES.turnos} mensajes de la charla; los anteriores se olvidan.`,
  `Hasta ${LIMITES.porMinuto} preguntas por minuto desde la misma conexión.`,
  `Cada respuesta recomienda hasta ${LIMITES.fichas} fichas y tiene un largo máximo de ${LIMITES.respuesta} caracteres.`,
  `Después de ${LIMITES.charlaLarga} preguntas, la página sugiere seguir con una persona por WhatsApp.`,
];

export function markdown() {
  const P = POLITICA;
  const l = (xs) => xs.map((x) => `- ${x}`).join("\n");
  return `# Política del asistente «Preguntale al Radar»

> Archivo generado desde \`worker/src/policy.mjs\` con \`npm run policy\`. No editar a mano.
> La misma política arma las instrucciones del modelo y la página https://radar.zustrolabs.com/asistente.html.

## Para qué está
${P.proposito}

## Temas que sí toma
${l(P.temasSi)}

## Temas que no toma
Responde amable que solo ayuda con el Radar y no recomienda fichas:
${l(P.temasNo)}

## Temas sensibles
| Tema | Cómo responde |
|---|---|
${P.sensibles.map((s) => `| ${s.tema} | ${s.comoResponde} |`).join("\n")}

## Idiomas
${P.idiomas}

## Cómo escribe
${l(P.formato)}

## Límites
${l(limites)}

## Privacidad
${l(P.privacidad)}

## Controles automáticos (después de la IA)
${l(P.controles)}

## Cómo se prueba
- Tests unitarios del Worker y de estos controles: \`tests/unit/chat-worker.test.mjs\`.
- Evals con la IA real, un caso por regla: \`evals/chat/cases.json\` (mínimo 90 %), en el workflow «Evals de la IA».
- E2E de la ventana del chat en escritorio y celular: \`tests/radar.spec.ts\`.
`;
}

export function html() {
  const P = POLITICA;
  const ul = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Cómo responde el asistente · Radar Croacia</title>
<meta name="description" content="Qué temas toma el asistente del Radar Croacia, cómo responde, sus límites y cómo cuida tu privacidad.">
<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<link rel="canonical" href="https://radar.zustrolabs.com/asistente.html">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/styles.css">
</head><body>
<!-- Generado desde worker/src/policy.mjs con «npm run policy». No editar a mano. -->
<main class="wrap policy" id="politica">
  <p><a href="./">← Volver al Radar</a></p>
  <h1>Cómo responde el asistente</h1>
  <p class="sub">${esc(P.proposito)}</p>
  <section class="panel"><h2>Temas que sí toma</h2>${ul(P.temasSi)}</section>
  <section class="panel"><h2>Temas que no toma</h2><p>Responde amable que solo ayuda con el Radar.</p>${ul(P.temasNo)}</section>
  <section class="panel"><h2>Temas sensibles</h2><dl>${P.sensibles
    .map((s) => `<dt>${esc(s.tema)}</dt><dd>${esc(s.comoResponde)}</dd>`)
    .join("")}</dl></section>
  <section class="panel"><h2>Idiomas</h2><p>${esc(P.idiomas)}</p></section>
  <section class="panel"><h2>Cómo escribe</h2>${ul(P.formato)}</section>
  <section class="panel"><h2>Límites</h2>${ul(limites)}</section>
  <section class="panel"><h2>Privacidad</h2>${ul(P.privacidad)}</section>
  <section class="panel"><h2>Controles automáticos</h2><p>Después de la IA, un programa revisa cada respuesta:</p>${ul(P.controles)}</section>
  <p class="note">Es información, no asesoramiento legal. Radar Croacia es un proyecto gratuito de Zustro Labs, con el Ateneo Croata de Rosario como socio.</p>
</main>
</body></html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(new URL("docs/07_politica_chat.md", ROOT), markdown());
  writeFileSync(new URL("site/asistente.html", ROOT), html());
  console.log("Listo: docs/07_politica_chat.md y site/asistente.html");
}
