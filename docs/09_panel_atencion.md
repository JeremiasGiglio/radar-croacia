# Panel de atención por WhatsApp (ZL-65)

Cuando alguien escribe **PERSONA** en el WhatsApp del Radar, el bot se pausa en esa charla y una persona del equipo la lee y responde desde **https://atencion.zustrolabs.com**. Cuando termina, aprieta «Devolver al bot» y el asistente vuelve a contestar.

## Cómo funciona

```
Persona escribe PERSONA
  → el bot confirma («le avisamos al equipo… guardamos lo que escribas por 30 días…»)
  → se abre la charla en el panel (KV chat:<número>, vence a los 30 días)
  → le llega un mail a Jeremías: «hay una charla esperando» (sin número ni texto)
Persona sigue escribiendo
  → el bot no contesta ni llama a la IA; cada mensaje queda en la charla y renueva la pausa 24 h
Equipo responde desde el panel
  → sale por la Graph API, solo dentro de las 24 h del último mensaje de la persona (regla de WhatsApp)
Equipo aprieta «Devolver al bot»
  → el bot vuelve a contestar y le avisa a la persona
BORRAR (en cualquier momento)
  → se borran perfil, estado y la charla guardada
```

Código: `worker/src/atencion.mjs` (charlas, login, API, página y mail), `handleEvent` en `worker/src/whatsapp.mjs` y el ruteo por host en `worker/src/index.mjs`.
Tests: `tests/unit/atencion.test.mjs`.

## Qué se guarda (decidido el 19/10/2026)

| Qué | Dónde | Cuánto |
|---|---|---|
| Charla con el bot (sin PERSONA) | En ningún lado | — |
| Perfil, estado y fecha del último mensaje | KV `wa:<número>` | 90 días |
| Mensajes desde que escribe PERSONA, y las respuestas del equipo | KV `chat:<número>` | 30 días desde el último |
| Índice del panel (número, fechas, abierta o no; sin texto) | KV `chats:idx` | 30 días |
| Registros del Worker | Cloudflare | Solo métricas, sin número ni texto |

Topes: 200 mensajes por charla, 1.600 caracteres por mensaje guardado y 1.000 por respuesta del equipo.

## Seguridad (con test)

| Riesgo | Control |
|---|---|
| Alguien entra al panel | **Cloudflare Access** delante del subdominio (login solo para el mail autorizado). Además el Worker verifica el token de Access: firma RS256 con las claves del equipo, audiencia, vencimiento y que el mail esté en `PANEL_EMAILS`. |
| Panel mal configurado | Si faltan `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` o `PANEL_EMAILS`, responde **503**: nunca queda abierto. El deploy falla si el panel da 200 sin login. |
| Un sitio ajeno hace que el navegador logueado mande una respuesta (CSRF) | Las acciones solo aceptan JSON y el `Origin` del propio panel. |
| Un mensaje con HTML o scripts | El panel pinta todo con `textContent`. CSP sin `unsafe-inline`, sin iframes, `noindex`. |
| Responder fuera de la ventana de WhatsApp | 409 si pasaron 24 h desde el último mensaje de la persona. |
| Datos personales en el mail | El aviso no tiene el número ni el texto: solo el link al panel. |
| Datos personales en el repo | El mail autorizado y el destinatario del aviso son **secretos** de Cloudflare. El test falla si aparece un `@gmail.com` en `wrangler.toml`. |
| Costo | Unas 3 escrituras de KV por mensaje en modo persona (plan gratis: 1.000 por día). Sin IA mientras atiende una persona. |

## Estado al 19/10/2026

- Zero Trust Free activado. App de Access «Panel de atención» para `atencion.zustrolabs.com`, política «Solo Jeremías» (un solo mail), sesión de 24 h. Login con la cuenta de Cloudflare o código por mail.
- `WHATSAPP_PANEL`, `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` en `[vars]` (PR #26).
- Secretos `PANEL_EMAILS` y `AVISO_PARA` cargados por Jeremías. Email Routing: destino verificado.
- **Funciona de punta a punta (probado por Jeremías el 19/10):** PERSONA → mail de aviso → login → respuesta desde el panel → «Devolver al bot».
- Si alguna vez falta `PANEL_EMAILS`, el bot no considera activo el panel: PERSONA deriva al mail y el bot no se calla (con test).

## Puesta en marcha (Jeremías)

El primer PR dejó el panel **apagado**: el subdominio existe, pero responde 503 y PERSONA sigue derivando a contact@zustrolabs.com.

1. **Cloudflare → Zero Trust** (la primera vez pide un nombre de equipo y el plan; el *Free* alcanza, hasta 50 usuarios).
2. **Access → Applications → Add an application → Self-hosted**:
   - nombre: `Panel de atención`;
   - dominio: `atencion.zustrolabs.com`;
   - duración de la sesión: 24 h;
   - login: *One-time PIN* (código por mail) o Google;
   - política: **Allow**, *Include → Emails →* tu Gmail. Nadie más.
3. Copiá de la aplicación el **Application Audience (AUD) Tag** y de *Settings* el **team domain** (`<equipo>.cloudflareaccess.com`). No son secretos: pasáselos a Claude para el segundo PR.
4. **Secretos** del Worker `radar-api` (Settings → Variables and Secrets, tipo *Secret*):
   - `PANEL_EMAILS`: tu Gmail (si algún día entra alguien más, separados por coma);
   - `AVISO_PARA`: `contact@zustrolabs.com` (desde el 22/10/2026; antes, tu Gmail).
5. **Email Routing** del subdominio `avisos.zustrolabs.com` activo (el aviso sale de `avisos@avisos.zustrolabs.com`: desde el 22/10/2026 el correo de `zustrolabs.com` lo maneja Zoho Mail, ZL-107) y, en *Destination addresses*, la casilla de `AVISO_PARA` **verificada**.
6. Segundo PR (Claude): `WHATSAPP_PANEL = "1"`, `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` en `[vars]`.
7. Prueba: desde tu celu escribí PERSONA al bot → te llega el mail → entrás al panel → respondés → «Devolver al bot» → el bot vuelve a contestar.
8. Si el mail no llega: en *Observability* del Worker buscá la línea con `"que": "persona"`. `avisoError` dice por qué:
   - `sin_config`: falta el secreto `AVISO_PARA` (o el binding `AVISO`);
   - otro nombre (`Error`, `TypeError`…): Cloudflare no lo mandó; casi siempre, el destino no está verificado en *Destination addresses*.
   El registro no guarda el número ni el texto; los registros automáticos de cada pedido están apagados porque la ruta del panel lleva el número.

## Dominios

`atencion.zustrolabs.com` lo crea Wrangler como *custom domain* del Worker `radar-api`, igual que `api`. No tocar a mano. Queda anotado en ZL-7.
