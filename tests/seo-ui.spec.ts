// ZL-169: lo que ven los buscadores sin JavaScript, la marca y la interfaz simple en el celular.
import { test, expect, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";
import data from "../site/data/opportunities.json" with { type: "json" };

const total = data.opportunities.length;
const TEMAS = [
  "becas",
  "estudiar",
  "aprender-croata",
  "trabajar",
  "tramites",
  "emprender",
  "ayudas-locales",
  "proyectos",
];
const SITE = "https://radar.zustrolabs.com";

/** Color de un píxel de un PNG de 8 bits (RGB o RGBA), sin depender del navegador. */
function pixel(png: Buffer, x: number, y: number): number[] {
  let i = 8,
    w = 0,
    tipo = 0;
  const idat: Buffer[] = [];
  while (i < png.length) {
    const len = png.readUInt32BE(i),
      t = png.toString("ascii", i + 4, i + 8),
      d = png.subarray(i + 8, i + 8 + len);
    if (t === "IHDR") {
      w = d.readUInt32BE(0);
      tipo = d[9];
    }
    if (t === "IDAT") idat.push(d);
    i += 12 + len;
  }
  const bpp = tipo === 6 ? 4 : 3,
    fila = w * bpp,
    raw = inflateSync(Buffer.concat(idat)),
    prev = Buffer.alloc(fila),
    cur = Buffer.alloc(fila);
  for (let r = 0; r <= y; r++) {
    const f = raw[r * (fila + 1)];
    raw.copy(cur, 0, r * (fila + 1) + 1, (r + 1) * (fila + 1));
    for (let k = 0; k < fila; k++) {
      const a = k >= bpp ? cur[k - bpp] : 0,
        b = prev[k],
        c = k >= bpp ? prev[k - bpp] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const add = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      cur[k] = (cur[k] + add) & 255;
    }
    cur.copy(prev);
  }
  return [...cur.subarray(x * bpp, x * bpp + 3)];
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test.beforeEach(async ({ page }) => {
  await page.route(/cloudflareinsights\.com/, (r) =>
    r.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
});

/** Los bloques JSON-LD de un HTML, ya parseados. */
const jsonld = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const grafo = (html: string) => jsonld(html).flatMap((b) => b["@graph"] ?? [b]);

test.describe("Buscadores (sin JavaScript)", () => {
  test.skip(({ isMobile }) => isMobile, "lo servido es igual en el celular");

  test("robots, sitemap, íconos e imagen para compartir responden 200", async ({ request }) => {
    for (const p of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"])
      expect((await request.get(p)).status(), p).toBe(200);
    const og = await request.get("/assets/og.png");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    expect(await (await request.get("/robots.txt")).text()).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  test("el sitemap tiene la portada, cada tema y cada ficha", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    for (const t of TEMAS) expect(xml).toContain(`<loc>${SITE}/${t}/</loc>`);
    for (const o of data.opportunities) expect(xml).toContain(`<loc>${SITE}/f/${o.id}.html</loc>`);
  });

  test("el HTML servido ya trae el título de cada ficha, los eventos y las últimas revisiones", async ({ request }) => {
    const html = await (await request.get("/")).text();
    for (const o of data.opportunities) expect(html, o.id).toContain(esc(o.t));
    expect(html).toMatch(/<ul class="feed" id="ultimas"><li>/);
    expect(html).not.toContain("<!--prerender");
  });

  test("la portada: fuentes en el <head>, descripción corta, theme-color y JSON-LD completo", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain("fonts.googleapis.com/css2");
    expect(html.slice(html.indexOf("</head>"))).not.toContain("fonts.googleapis.com/css2");
    const desc = head.match(/<meta name="description" content="([^"]+)"/)![1];
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(head).toMatch(/<meta name="theme-color" content="#C8102E"/);
    expect(head).toContain(`<meta property="og:image" content="${SITE}/assets/og.png">`);
    const g = grafo(html);
    const tipo = (t: string) => g.filter((x) => x["@type"] === t);
    expect(tipo("Organization")[0].name).toBe("Zustro Labs");
    expect(tipo("WebSite")[0].url).toBe(`${SITE}/`);
    expect(tipo("ItemList")[0].numberOfItems).toBe(total);
    expect(tipo("ItemList")[0].itemListElement[0].url).toBe(`${SITE}/f/${data.opportunities[0].id}.html`);
    const hoy = new Date().toISOString().slice(0, 10);
    const proximos = data.events.filter((e: { end?: string; start?: string }) => e.start && (!e.end || e.end >= hoy));
    expect(tipo("Event").map((e) => e.name)).toEqual(proximos.map((e) => e.t));
  });

  test("cada ficha tiene su página con título, descripción, canonical, fuente y JSON-LD", async ({ request }) => {
    for (const o of data.opportunities) {
      const r = await request.get(`/f/${o.id}.html`);
      expect(r.status(), o.id).toBe(200);
      const html = await r.text();
      expect(html).toContain(`<h1>${esc(o.t)}</h1>`);
      expect(html).toContain(`<link rel="canonical" href="${SITE}/f/${o.id}.html">`);
      expect(html.match(/<meta name="description" content="([^"]+)"/)![1].length).toBeLessThanOrEqual(160);
      expect(html).toContain(`href="${esc(o.src[1])}"`);
      const g = grafo(html);
      expect(g.find((x) => x["@type"] === "WebPage").url).toBe(`${SITE}/f/${o.id}.html`);
      expect(g.find((x) => x["@type"] === "BreadcrumbList").itemListElement.at(-1).name).toBe(o.t);
      // Las tres situaciones, para que nadie tenga que suponer la propia.
      expect(html.match(/<ul class="el3">([\s\S]*?)<\/ul>/)![1].match(/<li>/g)).toHaveLength(3);
    }
  });

  test("cada tema tiene su página con sus fichas y links que funcionan", async ({ request }) => {
    for (const t of TEMAS) {
      const r = await request.get(`/${t}/`);
      expect(r.status(), t).toBe(200);
      const html = await r.text();
      const links = [...html.matchAll(/<h3><a href="(\/f\/[^"]+)"/g)].map((m) => m[1]);
      expect(links.length, t).toBeGreaterThan(0);
      expect(html).toContain(`${links.length} fichas`);
      const lista = grafo(html).find((x) => x["@type"] === "ItemList");
      expect(lista.numberOfItems).toBe(links.length);
      expect((await request.get(links[0])).status()).toBe(200);
    }
  });

  test("una dirección que no existe muestra la página 404 del Radar", async ({ request }) => {
    expect(await (await request.get("/404.html")).text()).toContain("No encontramos esa página");
  });
});

test.describe("Marca", () => {
  test.skip(({ isMobile }) => isMobile, "una vez alcanza");

  test("favicon: el damero arranca en rojo, nunca en blanco", async ({ request }) => {
    const svg = await (await request.get("/favicon.svg")).text();
    const primera = svg.match(/<rect x="0" y="0" width="[\d.]+" height="[\d.]+" fill="([^"]+)"/);
    expect(primera?.[1]).toBe("#C8102E");
  });

  for (const [img, x, y] of [
    ["/assets/og.png", 100, 195],
    ["/favicon.ico", 2, 2],
    ["/apple-touch-icon.png", 24, 24],
  ] as const) {
    test(`${img}: la primera casilla del damero es roja`, async ({ request }) => {
      let buf = await (await request.get(img)).body();
      // El .ico lleva un PNG adentro, después de 22 bytes de cabecera.
      if (img.endsWith(".ico")) buf = buf.subarray(22);
      const [r, g, b] = pixel(buf, x, y);
      expect(r).toBeGreaterThan(170);
      expect(g).toBeLessThan(60);
      expect(b).toBeLessThan(80);
    });
  }
});

async function cargar(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.locator('#list[data-render="js"] article')).toHaveCount(total);
}

test.describe("Interfaz simple", () => {
  test("las fichas arrancan compactas y se abren al tocar el título", async ({ page }) => {
    await cargar(page);
    const c = page.locator("#list article").first();
    const t = c.locator(".card-t");
    await expect(t).toHaveAttribute("aria-expanded", "false");
    await expect(c.locator(".card-det")).toBeHidden();
    await t.click();
    await expect(page.locator("#list article").first().locator(".card-t")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#list article").first().locator(".card-det")).toBeVisible();
    await expect(page.locator("#list article").first().locator(".card-det a.btn")).toHaveAttribute(
      "href",
      /^f\/.+\.html$/,
    );
  });

  test("se ven 10 fichas y «Ver más» muestra el resto", async ({ page }) => {
    await cargar(page);
    await expect(page.locator("#list article:visible")).toHaveCount(10);
    const mas = page.locator("#ver-mas");
    await expect(mas).toBeVisible();
    while (await mas.isVisible()) await mas.click();
    await expect(page.locator("#list article:visible")).toHaveCount(total);
  });

  test("/?f=<id> abre esa ficha aunque esté después de las primeras 10", async ({ page }) => {
    const ultima = data.opportunities.at(-1)!;
    await cargar(page, `/?f=${ultima.id}`);
    await expect(page.locator(`#card-${ultima.id}`)).toHaveClass(/sel/);
    await expect(page.locator(`#card-${ultima.id} .card-det`)).toBeVisible();
  });

  test("/?chat=1 abre el chat (lo usan las páginas de cada ficha)", async ({ page }) => {
    await cargar(page, "/?chat=1");
    await expect(page.locator("#chat")).toBeVisible();
  });

  test("eventos: los que terminaron se ocultan solos", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-03:00"));
    await cargar(page);
    await expect(page.locator("#events li")).toHaveCount(2);
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00-03:00"));
    await page.reload();
    await expect(page.locator("#events li")).toHaveCount(1);
    await expect(page.locator("#events")).not.toContainText("Córdoba");
    await page.clock.setFixedTime(new Date("2026-12-05T12:00:00-03:00"));
    await page.reload();
    await expect(page.locator("#events li")).toHaveCount(0);
    await expect(page.locator("#events-vacio")).toBeVisible();
  });

  test("«Últimas revisiones» sale de las fechas de las fichas y abre la ficha", async ({ page }) => {
    await cargar(page);
    const mas = [...data.opportunities].sort((a, b) => b.verified_at.localeCompare(a.verified_at))[0];
    await expect(page.locator("#ultimas li").first()).toContainText(mas.t);
    await page.locator("#ultimas li button").first().click();
    await expect(page.locator(`#card-${mas.id}`)).toHaveClass(/sel/);
  });

  test("la página no habla de un solo país ni muestra lo que se sacó", async ({ page }) => {
    await cargar(page);
    const texto = await page.locator("body").innerText();
    expect(texto).not.toMatch(/Sudamérica|sudamericana|Ateneo|Plomin|Próxima etapa|Cómo va a funcionar/);
  });
});

test.describe("Celular", () => {
  test.skip(({ isMobile }) => !isMobile, "solo celular");

  test("la página es corta: filtros y mapa plegados, fichas compactas", async ({ page }) => {
    await cargar(page);
    await expect(page.locator("#filtros")).not.toHaveAttribute("open", "");
    await expect(page.locator("#mapa")).not.toHaveAttribute("open", "");
    await expect(page.locator("#filtros-res")).toContainText("fichas");
    const alto = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(alto).toBeLessThan(6500);
  });

  test("nada más ancho que la pantalla, con filtros, mapa y fichas abiertos", async ({ page }) => {
    await cargar(page);
    await page.locator("#filtros summary").click();
    await page.locator("#mapa summary").click();
    await page.locator("#list article .card-t").first().click();
    const [client, scroll] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(client);
  });

  test("las páginas de ficha y de tema tampoco se salen de la pantalla", async ({ page }) => {
    for (const url of [`/f/${data.opportunities[0].id}.html`, "/estudiar/", "/404.html"]) {
      await page.goto(url);
      const [client, scroll] = await page.evaluate(() => [
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
      ]);
      expect(scroll, url).toBeLessThanOrEqual(client);
    }
  });

  test("el chat abierto ocupa toda la pantalla", async ({ page }) => {
    await cargar(page);
    await page.locator("#chat-open").click();
    const box = (await page.locator("#chat").boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBe(0);
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(vp.height - 1);
  });

  test("el botón del chat no tapa el final de la página", async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const fab = (await page.locator("#chat-open").boundingBox())!;
    const pie = (await page.locator("#made-by").boundingBox())!;
    expect(pie.y + pie.height).toBeLessThanOrEqual(fab.y);
  });
});

test("capturas de la portada (escritorio y celular)", async ({ page }, info) => {
  await cargar(page);
  await page.evaluate(() => document.fonts.ready);
  await info.attach(`portada-${info.project.name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
