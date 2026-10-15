# Arquitectura propuesta (MVP para el 5/11/2026 → versión completa de feb a jun de 2027)

```
           ┌────────────── GitHub Actions (cron diario 06:00 CET) ──────────────┐
fuentes →  │ adaptadores: rss | wordpress | html | playwright(js)  →  raw/*.json │
           │        │                                                           │
           │        ▼ normalizar + hash por ítem                                │
           │   data/items/<fuente>/<id>.json  (versionado en git = historial)   │
           │        │ solo nuevos o cambiados                                   │
           │        ▼                                                           │
           │   AGENTES LLM (salida JSON validada con esquema)                   │
           │   1. extractor_resumen  (HR→ES: qué, quién, monto, plazo, link)    │
           │   2. elegibilidad       (ar / cit / res → ok / cond / no + motivo) │
           │   3. diff_cambios       (plazo/monto/requisitos: antes→después)    │
           │        │                                                           │
           │        ▼                                                           │
           │   review/queue/*.json  → PR automático en GitHub                   │
           └────────────────────────────────────────────────────────────────────┘
                    │ aprobado por una persona (merge del PR)
                    ▼
     build estático: web (mapa + filtros + fichas) → GitHub/Cloudflare Pages
                     placas PNG semanales y boletín (Playwright) → Ateneo
```

## Fuentes, por orden (empezar por las que tienen RSS)
1. Oficina: `hrvatiizvanrh.gov.hr/rss.aspx?ID=574` (natječaji) + Vijesti.
2. MDU: javni pozivi (`mdu.gov.hr/javni-pozivi/5923`) + vijesti.
3. HZZ: `mjere.hzz.hr` (Biram Hrvatsku, potpore za samozapošljavanje).
4. PGŽ: `pgz.hr` (WordPress → `/wp-json/` o feed).
5. Grad Rijeka: `rijeka.hr` (natječaji, gospodarstvo).
6. udruge.gov.hr (registro central de convocatorias para asociaciones).
7. Matica: `matis.hr` (escuelas de verano, becas).
8. Después: zagreb.hr, split.hr, osijek.hr, eufondovi, data.gov.hr.

## Esquema de una oportunidad (compatible con `prototype/data/opportunities.json`)
```json
{
  "id": "slug-estable",
  "cat": "beca|emp|res|loc|proy",
  "t": "título en español",
  "t_hr": "título oficial en croata",
  "who": "organismo",
  "pts": [[lon, lat]],
  "deadline": "ISO-8601 o null",
  "next": "texto si no hay plazo",
  "amount": "texto tal cual la fuente",
  "what": "resumen en español (2–3 frases)",
  "el": {"ar": ["ok|cond|no", "motivo"], "cit": [...], "res": [...]},
  "src": ["nombre", "url oficial"],
  "verified_at": "YYYY-MM-DD",
  "verified_by": "persona del Ateneo",
  "ai_generated": true,
  "flag": "nota de duda (opcional)"
}
```

## Calidad (el diferencial: QA + IA)
- **Contratos por fuente:** fixtures de HTML/RSS guardados → tests del parser. La CI falla si una fuente trae 0 ítems o cambia de estructura.
- **Evals de los agentes:** un set de unas 30 convocatorias reales con la ficha esperada. Mide exactitud de monto, plazo y elegibilidad. Regla dura: **la IA no puede inventar montos ni fechas** (si no están en el texto, el campo va en null).
- **E2E + regresión visual** de la web con Playwright: filtros, perfiles, fichas, mobile y modo oscuro.
- **Accesibilidad:** axe en la CI.
- **Seguridad:** el contenido scrapeado es dato, no instrucción. El prompt de los agentes trata la página como texto no confiable (defensa contra prompt injection).

## Costos estimados
| Ítem | Costo |
|---|---|
| GitHub Actions | gratis en repo público |
| Pages | gratis |
| LLM | US$2–4/mes |
| Dominio (`zustrolabs.com`, Zustro Labs) | ~US$11/año |
| **Total** | **< €10/mes** |
