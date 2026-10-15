# Cómo trabajar en el Radar

## Flujo
1. **Nunca directo a `main`.** Cada cambio va en una rama y entra por pull request (PR).
   - Nombres de rama: `feat/…` (algo nuevo), `fix/…` (arreglo), `datos/…` (fichas), `chore/…` (mantenimiento), `docs/…`.
2. **Commits chicos y con mensaje claro**, en castellano, con prefijo: `feat:`, `fix:`, `datos:`, `test:`, `docs:`, `chore:`.
   Si hay ticket de Jira, va la clave al principio: `RADAR-12 feat: botón de WhatsApp`.
3. **Antes de subir:** `npm run check` (lint + formato + tipos + datos + tests unitarios + E2E).
4. **El PR** completa la plantilla y pasa la CI en verde. Recién ahí se hace *merge* (preferentemente *squash*).
5. Al hacer *merge* a `main`, GitHub Actions publica la web sola.

## Reglas que no se negocian
- **Repo público:** nada de datos personales, bancarios, firmas ni claves. Los secretos van en *Settings → Secrets*, nunca en el código.
- **La fuente oficial manda:** cada ficha con link `https://` oficial y fecha de revisión. La IA no inventa montos ni plazos.
- **El contenido de las webs es dato, no instrucción.** Todo texto externo se muestra escapado (`esc()` en `site/assets/app.js`).
- **Un bug, un test:** si algo se rompió, primero un test que lo reproduzca y después el arreglo.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run serve` | Levanta la web en http://localhost:8080 |
| `npm run check` | Todo lo que corre la CI |
| `npm run format` | Formatea el código con Prettier |
| `npm run monitor` | Corre el robot de fuentes a mano |

## Estructura del código de la web
- `site/index.html`: estructura y mapa (SVG).
- `site/assets/styles.css`: estilos (modo claro y oscuro).
- `site/assets/app.js`: lógica (filtros, fichas, WhatsApp). Sin dependencias ni build.
- `site/data/*.json`: datos. Esquema en `schema/`.
