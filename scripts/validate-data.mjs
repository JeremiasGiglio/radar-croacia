// Valida site/data/opportunities.json contra el esquema y reglas que el esquema no cubre.
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/opportunities.schema.json", import.meta.url)));
const data = JSON.parse(readFileSync(new URL("../site/data/opportunities.json", import.meta.url)));
const ajv = new Ajv({ allErrors: true, strictTuples: false });
addFormats(ajv);

const errors = [];
if (!ajv.validate(schema, data)) errors.push(...ajv.errors.map(e => `${e.instancePath} ${e.message}`));

const ids = new Set();
for (const o of data.opportunities ?? []) {
  if (ids.has(o.id)) errors.push(`id repetido: ${o.id}`);
  ids.add(o.id);
  if (!data.categories?.[o.cat]) errors.push(`${o.id}: categoría desconocida ${o.cat}`);
  if (o.verified_at > data.verified_at) errors.push(`${o.id}: verified_at posterior a la revisión general`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s) en los datos:\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log(`✓ ${data.opportunities.length} fichas válidas (revisión ${data.verified_at})`);
