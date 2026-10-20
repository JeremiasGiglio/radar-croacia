# Radar Croacia 🇭🇷 · Radar Hrvatska

**Programas, becas y oportunidades en Croacia, para la diáspora sudamericana y para quien quiera ir. En español, filtrados según tu situación y en un mapa.**

Becas, cursos y estudios universitarios (también universidades privadas con carreras en inglés), portales de trabajo, residencia, ayudas para emprender, programas municipales y convocatorias para proyectos de la comunidad. Cada ficha dice qué tipo de fuente es (oficial, institución, portal de empleo) y si está abierta a todos o pide ascendencia croata. Un proceso automático revisa todos los días las páginas oficiales croatas, la IA resume en español lo nuevo y una persona del equipo verifica cada ficha antes de publicarla.

> Proyecto de **Zustro Labs**, el estudio de QA e IA de **Jeremías Ismael Giglio**, con el **Ateneo Croata de Rosario** como socio.
> Presentado a la **Convocatoria Pública 2026 de la Oficina Central para los Croatas fuera de Croacia** (Cat. B, formulario 51709, enviado el 7/10/2026).

---

## Estado al 14/10/2026
| Pieza | Estado |
|---|---|
| Investigación de mercado, técnica y legal | ✅ `docs/01_investigacion_y_factibilidad.md` |
| Web pública (mapa + filtros + fichas) | ✅ `site/`, publicada con GitHub Pages: https://radar.zustrolabs.com (antes `radar.jgcup.stream`, que redirige) |
| Maqueta offline para eventos | ✅ `prototype/index.html` (datos del 28/9/2026 embebidos; funciona sin internet) |
| Datos en JSON con esquema | ✅ `site/data/opportunities.json` (28 fichas, revisión 20/10/2026; cada una con tipo de fuente y si está abierta a todos) + `schema/` |
| Tests | ✅ validación del JSON, 7 tests del robot con copias reales de los feeds y 15 E2E con Playwright (escritorio, celular y celular chico) |
| Video demo con subtítulos | ✅ `media/Radar_Croacia_demo.mp4` |
| Monitoreo diario de fuentes | 🟡 6 de 12: Oficina, MDU, PGŽ, Grad Rijeka, HZZ y Ured za udruge (RSS y API de WordPress). Robot diario + PR de revisión (`.github/workflows/monitor.yml`, `review/`) |
| Botón de consultas por WhatsApp | ✅ +54 9 341 335-0686 (`site/data/contact.json`) |
| Chat con IA en la web («Preguntale al Radar») | ✅ Worker de Cloudflare en `api.zustrolabs.com` (`worker/`), Claude Haiku 5.5, responde solo con las fichas verificadas, deriva a WhatsApp. Evals en `evals/chat/` |
| Agentes de IA (resumen, elegibilidad, detección de cambios) | 🟡 agente que resume y clasifica por perfil (`scripts/agents/`, Claude Haiku 5.5, salida con esquema). Montos y plazos solo si están textuales en la fuente. Evals con 7 convocatorias (`evals/summarize/`) |
| Revisión humana (panel de revisión) | ⬜ por construir |
| Avisos, boletín y posteos semanales | ⬜ por construir |
| Dominio | ✅ `radar.zustrolabs.com` (Zustro Labs, en Cloudflare) |

## Fechas que mandan
| Fecha | Qué | Necesita |
|---|---|---|
| **21/10/2026** | Resumen para el IV Encuentro IMIN (ponencia sobre el Radar) | Texto listo (`docs/05_presentaciones.md`) |
| **5–8/11/2026** | **9.º Encuentro de la Diáspora Croata Sudamericana, Córdoba** | **Demo en vivo** que funcione sin internet + volante con QR |
| **30/11–2/12/2026** | IV Encuentro IMIN, sede Rosario | Charla de 10–15 min con demo |
| Fines nov 2026 – ene 2027 | Resolución de la Oficina | — |
| **1/2 – 30/6/2027** | **Ejecución del proyecto financiado** (si se aprueba) | Ver compromisos en `docs/02_compromisos_convocatoria.md` |

## Cómo verlo
- **Online:** https://radar.zustrolabs.com
- **En tu compu:** `npm install` y después `npm run serve` → http://localhost:8080
- **Sin internet (eventos):** abrí `prototype/index.html` directamente.

## Cómo actualizar una ficha
1. Editá `site/data/opportunities.json` (el esquema está en `schema/opportunities.schema.json`).
2. `npm test` valida los datos y corre los tests.
3. Commit y push a `main`: GitHub Actions corre los tests y, si pasan, publica.

## Botón de WhatsApp
Cargá el número en `site/data/contact.json` (campo `whatsapp`, con código de país, por ejemplo `+54 9 341 …`).
Con el campo vacío los botones no aparecen. Cada ficha arma la consulta con su título y el perfil elegido; la persona la manda desde su WhatsApp y se contesta a mano desde la app de WhatsApp Business (gratis).

## Robot diario
- Fuentes en `scripts/sources.json`; adaptador RSS en `scripts/lib/rss.mjs`.
- Corre todos los días a las 05:17 UTC (o a mano: *Actions → Robot diario → Run workflow*).
- Guarda cada fuente en `data/sources/` (el historial de git muestra qué cambió) y, si hay novedades, abre un PR con la cola en `review/queue/`. Ver `review/README.md`.
- Falla en rojo si una fuente trae 0 ítems o cambia de estructura.

## Estructura
```
site/                 web publicada (index.html + data/opportunities.json)
prototype/            maqueta original con datos embebidos (modo offline)
schema/               esquema JSON de las fichas
tests/                tests E2E con Playwright
docs/                 investigación, compromisos, arquitectura, roadmap, presentaciones
privado/, convocatoria/  (no van a GitHub) documentos con firmas, datos personales y borradores
media/                video demo + subtítulos
scripts/              build de la web, actualización y validación de datos (scrapers y agentes irán acá)
CLAUDE.md             contexto para el chat de desarrollo
```

## Principios (no negociables)
1. **La fuente oficial manda.** Cada ficha lleva el link oficial y la fecha de revisión.
2. **Revisión humana** antes de publicar. La IA propone; una persona aprueba.
3. **Gratis y de código abierto** para la comunidad (es un compromiso con la Oficina). El Radar es de Zustro Labs, con el Ateneo como socio (ver la nota en `docs/02_compromisos_convocatoria.md`).
4. **Legal:** se reutiliza información pública (ZPPI, Directiva 2019/1024). Se enlazan los PDF, no se vuelven a alojar. Sin datos personales de resoluciones. Se respeta robots.txt, con visitas espaciadas y un User-Agent identificable.
5. "Es información, no asesoramiento legal."
