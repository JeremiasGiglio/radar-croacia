// Llamada mínima a la API de Claude (Messages) con salida JSON validada por esquema.
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { MODEL, SYSTEM, DRAFT_SCHEMA, userMessage } from "./prompt.mjs";

const API = "https://api.anthropic.com/v1/messages";
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
export const validateDraft = ajv.compile(DRAFT_SCHEMA);

/** Esquema que se manda a la API: sin metadatos ($schema, $id, title) que no hacen falta. */
export function apiSchema() {
  // eslint-disable-next-line no-unused-vars
  const { $schema, $id, title, description, ...rest } = DRAFT_SCHEMA;
  return rest;
}

export function buildRequest(item, sourceText, { model = MODEL, maxTokens = 8000 } = {}) {
  return {
    model,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage(item, sourceText) }],
    output_config: { format: { type: "json_schema", schema: apiSchema() } },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {Promise<{draft:any, usage:{input_tokens:number, output_tokens:number}}>}
 */
export async function callClaude(
  item,
  sourceText,
  { apiKey = process.env.ANTHROPIC_API_KEY, workspaceId = process.env.ANTHROPIC_WORKSPACE_ID, fetchImpl = fetch } = {},
) {
  if (!apiKey) throw new Error("falta ANTHROPIC_API_KEY");
  const body = JSON.stringify(buildRequest(item, sourceText));
  let res, data;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetchImpl(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Claves de la organización que no están atadas a un workspace: hay que decir cuál usar.
        ...(workspaceId ? { "anthropic-workspace-id": workspaceId } : {}),
      },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    data = await res.json().catch(() => ({}));
    if (res.ok) break;
    if (![429, 500, 502, 503, 529].includes(res.status) || attempt === 3) {
      throw new Error(`API ${res.status}: ${data?.error?.message ?? "sin detalle"}`);
    }
    await sleep(2000 * attempt);
  }
  if (data.stop_reason === "refusal") throw new Error("el modelo no quiso responder");
  if (data.stop_reason === "max_tokens") throw new Error("la respuesta se cortó (max_tokens)");
  const text = (data.content ?? []).find((b) => b.type === "text")?.text;
  let draft;
  try {
    draft = JSON.parse(text);
  } catch {
    throw new Error("la respuesta no es JSON");
  }
  if (!validateDraft(draft)) {
    throw new Error("no cumple el esquema: " + ajv.errorsText(validateDraft.errors));
  }
  return { draft, usage: data.usage ?? { input_tokens: 0, output_tokens: 0 } };
}
