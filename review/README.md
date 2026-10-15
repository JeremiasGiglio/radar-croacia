# Cola de revisión

El robot diario (`.github/workflows/monitor.yml`) lee las fuentes de `scripts/sources.json`.
Si encuentra algo nuevo o cambiado, deja un archivo en `review/queue/` y abre un **pull request**.

**Nada se publica solo.** Para cada ítem del PR:
1. Abrí el link oficial.
2. Si sirve para descendientes, creá o actualizá la ficha en `site/data/opportunities.json` (en el mismo PR o en otro).
3. Aprobá y hacé *merge*. Si no sirve (por ejemplo, un aviso interno de empleo público), hacé *merge* igual: así queda registrado como visto.

Si el robot marca ❌, una fuente cambió de estructura o dejó de responder: revisar el adaptador.

## Borradores de la IA
Después de leer las fuentes, el robot corre `scripts/agents/summarize.mjs` sobre lo nuevo:
- lee la página oficial y le pide a Claude Haiku un **borrador de ficha** en castellano (qué es, quién la da, monto, plazo y elegibilidad por perfil);
- el borrador queda en el mismo archivo de `review/queue/`, en `borradores[].ficha`, con la forma de `site/data/opportunities.json` (faltan `id`, `pts` y `verified_at`, que los pone quien revisa);
- **montos y plazos:** solo quedan si la IA copia la frase textual de la fuente y la cifra o la fecha coinciden. Si no, se borran y queda una nota en `flag`;
- el contenido de las páginas es dato: si trae instrucciones escondidas, se ignoran y se sacan los links que no son de la fuente.

Siempre abrí el link oficial antes de aprobar. Los evals (`node scripts/agents/eval-summarize.mjs` o el workflow «Evals del agente que resume») miden el agente con convocatorias reales.
