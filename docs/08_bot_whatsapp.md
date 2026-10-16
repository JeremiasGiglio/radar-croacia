# Bot de atención por WhatsApp (ZL-22)

El mismo asistente del chat de la web, por WhatsApp. Usa la misma política (`worker/src/policy.mjs`), las mismas fichas verificadas y los mismos controles: no inventa montos, no escribe links propios y deriva a una persona cuando el caso es personal.

## Cómo funciona

```
Persona escribe por WhatsApp
  → Meta (Cloud API) manda el mensaje a https://api.zustrolabs.com/whatsapp
  → el Worker verifica la firma X-Hub-Signature-256 (si no coincide: 401, no se procesa)
  → contesta 200 a Meta enseguida y procesa aparte (ctx.waitUntil)
  → ¿comando? BORRAR · PERSONA · PERFIL (sin IA)
  → ¿atiende una persona? el bot no contesta (24 h o hasta que el panel lo devuelva)
  → si no: Claude Haiku con el aviso de canal → controles → respuesta + fuente oficial de cada ficha
  → se manda con la Graph API
```

Código: `worker/src/whatsapp.mjs` (lógica) y la ruta `/whatsapp` en `worker/src/index.mjs`.
Tests: `tests/unit/whatsapp.test.mjs` con mensajes de ejemplo ficticios en `tests/fixtures/whatsapp/`.

## Qué recuerda

| Sin memoria (hoy) | Con memoria (cuando se decida ZL-66) |
|---|---|
| Responde cada mensaje solo, con el perfil `ar` y lo que la persona cuente. | En el primer mensaje pregunta el perfil con 3 botones y lo recuerda. |
| PERSONA avisa, pero el bot sigue contestando. | PERSONA silencia al bot 24 h en esa charla. |
| — | Un mensaje que Meta reintenta no se responde dos veces. |

La memoria (KV `WA_STATE`) guarda por número **solo** `{perfil, humanoHasta, visto}` y vence a los 90 días. **Nunca el texto de los mensajes.** BORRAR la elimina. Los registros solo tienen métricas: ni el número ni el texto.

El historial de mensajes para que una persona responda desde un panel es otro tema: ZL-65 (panel de atención) y ZL-66 (cuánto se guarda).

## Comandos

- **PERSONA** (o «humano», «hablar con una persona»): pide que responda alguien del equipo.
- **BORRAR** (o «olvidame»): borra perfil y estado.
- **PERFIL**: vuelve a mostrar los botones de perfil.

## Reglas de Meta que hay que respetar

- **Ventana de 24 h:** el bot solo responde a mensajes recibidos, así que siempre está dentro de la ventana. Escribirle a alguien después de 24 h exige una plantilla aprobada (paga) y que la persona haya aceptado recibir avisos.
- **Desde el 15/1/2026 Meta no permite asistentes de IA de uso general** en la API. El bot cumple porque solo responde sobre el Radar y rechaza lo demás (`temasNo` de la política).
- **Coexistencia:** el número real deja de funcionar en la app de WhatsApp Business al pasarlo a la API, salvo que se use un proveedor (BSP). Decisión en ZL-24.

## Puesta en marcha

1. **ZL-21 (Jeremías):** portfolio comercial «Zustro Labs» y app de Meta con el caso de uso WhatsApp. Usar el número de prueba de Meta, con hasta 5 destinatarios. No sumar el número real todavía.
2. **Secretos del Worker** (Cloudflare → Workers → `radar-api` → Settings → Variables and Secrets, tipo *Secret*). Nunca en el chat, en el repo ni en Jira:
   - `WHATSAPP_TOKEN`: token permanente de un usuario del sistema del portfolio, con permisos `whatsapp_business_messaging` y `whatsapp_business_management`;
   - `WHATSAPP_APP_SECRET`: app de Meta → Configuración → Básica → Clave secreta;
   - `WHATSAPP_VERIFY_TOKEN`: una frase inventada; es la misma que se pega en Meta en el paso 4.
3. **Variable** `WHATSAPP_PHONE_NUMBER_ID` en `wrangler.toml`. Es el id del número que muestra «Configuración de la API». No es secreto, pero va por PR. Si la Graph API cambia de versión, va en `WHATSAPP_GRAPH_VERSION` (hoy `v23.0`).
4. **En Meta:** WhatsApp → Configuración → Webhook:
   - URL: `https://api.zustrolabs.com/whatsapp`;
   - token: el `WHATSAPP_VERIFY_TOKEN`;
   - campo suscripto: **messages**.
5. Mandar «hola» desde un número de prueba y revisar los registros del Worker. Solo deben aparecer métricas.

## Pendiente

- ZL-23: evals del bot por WhatsApp (los del chat, con el aviso de canal).
- ZL-65: panel de atención, con login, para responder como persona y devolverle la charla al bot.
- ZL-66: qué se guarda y cuánto tiempo.
- ZL-24: número real (solo API o BSP).
