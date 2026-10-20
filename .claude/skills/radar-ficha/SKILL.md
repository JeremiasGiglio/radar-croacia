---
name: radar-ficha
description: Agregar, corregir o cerrar una oportunidad (ficha) del Radar Croacia en site/data/opportunities.json a partir de una fuente oficial. Usar cuando piden sumar una beca, ayuda, convocatoria o trámite, o actualizar montos, plazos o elegibilidad.
---

# Nueva ficha o corrección

## Antes de escribir
1. Abrí la **página oficial** o la de la institución que ofrece el programa (no una nota de prensa, salvo que no haya otra; en ese caso, `flag` con la aclaración).
2. Anotá tal cual: quién la da, monto, plazo, requisitos de residencia o ciudadanía. **Lo que no esté en la fuente no se escribe.**
3. **Requisitos, montos y plazos se leen en el documento oficial** (PDF o DOCX: Javni poziv, Upute za prijavitelje, Pravilnik), **nunca en la página web que lo resume**: los resúmenes omiten cosas (por ejemplo, «uključuje i samozapošljavanje»). En `src` va el link a ese documento, no a la portada.
4. Un «Revisar» en `flag` solo si, después de leer el documento oficial, de verdad falta un dato; y siempre con `src` apuntando a ese documento. El test `tests/unit/data.test.mjs` falla si no.

## Campos (esquema: `schema/opportunities.schema.json`)
- `id`: slug estable en minúsculas con `_` (no se cambia nunca; lo usan los links de WhatsApp).
- `cat`: `beca` (becas y estudios) | `emp` | `trab` (solo portales u organismos oficiales, nunca avisos sueltos) | `res` | `loc` | `proy`.
- `fuente`: `oficial` (Estado, región, ciudad, universidad pública, agencia estatal, Narodne novine) | `institucion` (universidad privada, fundación, asociación) | `portal` (portal de empleo) | `prensa` (solo si no hay otra; con `flag`).
- `abierta`: `true` si no pide ascendencia ni ciudadanía croata (abierta a todos); si no, `false`.
- `t` en castellano claro; `t_hr` con el nombre oficial en croata si existe.
- `deadline` (ISO con zona horaria de Croacia, p. ej. `2026-10-19T23:59:00+02:00`) **o** `next` (texto: "Junio 2027", "Todo el año").
- `amount` y `what` en rioplatense, sin jerga; 2–3 frases.
- `el.ar` / `el.cit` / `el.res`: `["ok"|"cond"|"no", "motivo corto"]`. **Ante la duda, `cond`** y explicar qué falta confirmar.
- `pts`: `[lon, lat]` dentro de Croacia (Zagreb `[15.98, 45.81]`, Rijeka `[14.44, 45.33]` para organismos nacionales o locales).
- `src`: `["dominio", "https://url-exacta"]` (el documento oficial, no la portada ni una nota de prensa); `verified_at`: fecha de hoy (`YYYY-MM-DD`). Actualizá también el `verified_at` general si es posterior.
- `flag`: lo que queda por verificar.

## Cerrar una convocatoria
No se borra: queda con su `deadline` pasado (la web la muestra "Cerrada" y al final) y en `what` o `next` va cuándo sale la próxima, si se sabe.

## Verificar y entregar
1. `npm run validate` y `npm test`.
2. Rama `datos/<id>`, commit `datos: <qué cambió> (<fuente>)`, PR con la plantilla.
3. En el PR, el link oficial de cada dato nuevo.
