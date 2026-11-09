// Reintentos para errores de red (ZL-132): los sitios de gov.hr a veces cortan la conexión desde el exterior.
// Solo se reintenta lo que es de red (timeout, conexión rechazada o cortada, DNS); un HTTP 404 o 500 no.
const NET = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

export function isNetworkError(e) {
  if (!e) return false;
  if (e.name === "TimeoutError" || e.name === "AbortError") return true;
  const code = e.cause?.code ?? e.code;
  return NET.has(code) || /fetch failed/i.test(String(e.message));
}

/** Corre fn(); si falla por red, espera y reintenta. waits = pausas entre intentos, en ms. */
export async function withRetry(
  fn,
  { waits = [5000, 15000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {},
) {
  for (let i = 0; ; i++) {
    try {
      return await fn(i);
    } catch (e) {
      if (i >= waits.length || !isNetworkError(e)) throw e;
      await sleep(waits[i]);
    }
  }
}
