// ZL-132: reintentos ante errores de red del robot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry, isNetworkError } from "../../scripts/lib/retry.mjs";

const netErr = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
const noSleep = async () => {};

test("reintenta un error de red y devuelve el resultado cuando anda", async () => {
  let n = 0;
  const r = await withRetry(
    async () => {
      n++;
      if (n < 3) throw netErr();
      return "ok";
    },
    { sleep: noSleep },
  );
  assert.equal(r, "ok");
  assert.equal(n, 3);
});

test("después de los reintentos, devuelve el último error", async () => {
  let n = 0;
  await assert.rejects(
    withRetry(
      async () => {
        n++;
        throw netErr();
      },
      { sleep: noSleep },
    ),
    /fetch failed/,
  );
  assert.equal(n, 3);
});

test("un error que no es de red (HTTP 404) no se reintenta", async () => {
  let n = 0;
  await assert.rejects(
    withRetry(
      async () => {
        n++;
        throw new Error("HTTP 404");
      },
      { sleep: noSleep },
    ),
    /HTTP 404/,
  );
  assert.equal(n, 1);
});

test("isNetworkError reconoce timeouts y cortes, no errores comunes", () => {
  assert.ok(isNetworkError(netErr()));
  assert.ok(isNetworkError(Object.assign(new Error("x"), { name: "TimeoutError" })));
  assert.ok(isNetworkError(Object.assign(new Error("x"), { cause: { code: "ECONNRESET" } })));
  assert.ok(!isNetworkError(new Error("contrato roto: trajo 0 ítems")));
});
