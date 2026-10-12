# Cola de revisión

El robot diario (`.github/workflows/monitor.yml`) lee las fuentes de `scripts/sources.json`.
Si encuentra algo nuevo o cambiado, deja un archivo en `review/queue/` y abre un **pull request**.

**Nada se publica solo.** Para cada ítem del PR:
1. Abrí el link oficial.
2. Si sirve para descendientes, creá o actualizá la ficha en `site/data/opportunities.json` (en el mismo PR o en otro).
3. Aprobá y hacé *merge*. Si no sirve (por ejemplo, un aviso interno de empleo público), hacé *merge* igual: así queda registrado como visto.

Si el robot marca ❌, una fuente cambió de estructura o dejó de responder: revisar el adaptador.
