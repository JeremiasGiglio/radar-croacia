// ZL-129: las páginas cuentan visitas con Cloudflare Web Analytics (sin cookies) y la CSP lo permite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGES = ["site/index.html", "site/asistente.html", "site/privacidad.html"];
const TOKEN = "c8b1f991a80a462395ecc8dd99f2aad3";

function csp(html) {
  const m = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(m, "falta la CSP");
  return m[1];
}

for (const page of PAGES) {
  test(`${page}: tiene el beacon de Web Analytics con el token del Radar`, () => {
    const html = readFileSync(page, "utf8");
    assert.match(html, /src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/);
    assert.ok(html.includes(`"token": "${TOKEN}"`), "token del sitio radar.zustrolabs.com");
    assert.equal((html.match(/beacon\.min\.js/g) || []).length, 1, "un solo beacon");
  });

  test(`${page}: la CSP permite el beacon y nada más externo para scripts`, () => {
    const c = csp(readFileSync(page, "utf8"));
    const script = c.split(";").find((d) => d.trim().startsWith("script-src"));
    assert.ok(script, "script-src explícito");
    assert.deepEqual(
      script.trim().split(/\s+/).slice(1).sort(),
      ["'self'", "https://static.cloudflareinsights.com"].sort(),
    );
    assert.match(c, /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
    assert.doesNotMatch(c, /unsafe-eval/);
  });
}

test("privacidad: explica la medición sin cookies", () => {
  const html = readFileSync("site/privacidad.html", "utf8");
  assert.match(html, /Cloudflare Web Analytics/);
  assert.match(html, /no usa cookies/);
});
