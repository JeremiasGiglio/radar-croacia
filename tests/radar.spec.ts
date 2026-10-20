import { test, expect } from "@playwright/test";
import data from "../site/data/opportunities.json" with { type: "json" };

const total = data.opportunities.length;
const usefulFor = (p: "ar" | "cit" | "res") => data.opportunities.filter((o) => o.el[p][0] !== "no").length;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#list article")).toHaveCount(total);
});

test("carga todas las fichas desde el JSON", async ({ page }) => {
  await expect(page).toHaveTitle(/Radar Croacia/);
  await expect(page.locator("#count")).toHaveText(`${usefulFor("ar")} de ${total} te sirven`);
});

for (const p of ["ar", "cit", "res"] as const) {
  test(`el perfil "${p}" cuenta bien las que sirven`, async ({ page }) => {
    await page.locator(`#pf-${p}`).click();
    await expect(page.locator(`#pf-${p}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#count")).toHaveText(`${usefulFor(p)} de ${total} te sirven`);
  });
}

test("apagar una categoría saca sus fichas", async ({ page }) => {
  const becas = data.opportunities.filter((o) => o.cat === "beca").length;
  await page.locator("#cat-beca").click();
  await expect(page.locator("#cat-beca")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#list article")).toHaveCount(total - becas);
});

test("cada ficha tiene enlace oficial https y fecha de revisión", async ({ page }) => {
  const cards = page.locator("#list article");
  for (let i = 0; i < total; i++) {
    const card = cards.nth(i);
    await expect(card.locator(".src a:not(.wa)")).toHaveAttribute("href", /^https:\/\//);
    await expect(card.locator(".src")).toContainText(/Revisado \d{2}\/\d{2}\/\d{4}/);
  }
});

test("tocar un marcador del mapa selecciona su ficha", async ({ page }) => {
  await page.locator("#markers .mk:not(.cluster)").first().click();
  await expect(page.locator("#list article.sel")).toHaveCount(1);
});

test("muestra los eventos y la nota de revisión", async ({ page }) => {
  await expect(page.locator("#events li")).toHaveCount(data.events.length);
  await expect(page.locator("#note")).toContainText(data.note);
});

test("no hay errores de consola", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#list article")).toHaveCount(total);
  expect(errors).toEqual([]);
});

test("el texto de los datos se muestra escapado, no como HTML", async ({ page }) => {
  await page.route("**/data/opportunities.json", async (route) => {
    const body = structuredClone(data);
    body.opportunities[0].t = '<img src=x onerror="window.__xss=1">Prueba';
    await route.fulfill({ json: body });
  });
  await page.reload();
  await expect(page.locator("#list")).toContainText('<img src=x onerror="window.__xss=1">Prueba');
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
});

test("las convocatorias cerradas van al final de la lista", async ({ page }) => {
  const closed = data.opportunities.filter(
    (o) => "deadline" in o && o.deadline && new Date(o.deadline) < new Date(),
  ).length;
  test.skip(closed === 0, "no hay convocatorias cerradas en los datos");
  const pills = await page
    .locator("#list article")
    .evaluateAll((cards) => cards.map((c) => c.querySelector(".pill")?.textContent ?? ""));
  const firstClosed = pills.findIndex((t) => t.includes("Cerrada"));
  expect(firstClosed).toBe(total - closed);
});

test.describe("Programas en Croacia (ZL-79)", () => {
  const abiertas = data.opportunities.filter((o) => o.abierta === true).length;

  test("el subtítulo habla de programas en Croacia, no de «oportunidades oficiales para descendientes»", async ({
    page,
  }) => {
    await expect(page.locator(".sub")).toContainText("Programas, becas y oportunidades en Croacia");
    await expect(page.locator("header")).not.toContainText(/oficiales para descendientes/i);
    await expect(page).toHaveTitle(/Programas, becas y oportunidades en Croacia/);
  });

  test("«Solo las abiertas a todos» deja solo las que no piden ascendencia croata", async ({ page }) => {
    test.skip(abiertas === 0, "no hay fichas abiertas a todos");
    const b = page.locator("#solo-abiertas");
    await b.click();
    await expect(b).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#list article")).toHaveCount(abiertas);
    await expect(page.locator("#list article .p-abierta")).toHaveCount(abiertas);
    await b.click();
    await expect(page.locator("#list article")).toHaveCount(total);
  });

  test("cada ficha dice qué tipo de fuente es (oficial, institución, portal o prensa)", async ({ page }) => {
    for (const o of data.opportunities) {
      await expect(page.locator(`#card-${o.id} .src-tipo`)).toContainText(
        (data as { fuentes: Record<string, string> }).fuentes[o.fuente],
      );
    }
  });

  test("hay una categoría Trabajo", async ({ page }) => {
    await expect(page.locator("#cat-trab")).toHaveText("Trabajo");
  });

  test("con muchas fichas en un lugar, el mapa las agrupa en un círculo con el número y se abre al tocarlo", async ({
    page,
  }) => {
    const porLugar: Record<string, number> = {};
    for (const o of data.opportunities)
      for (const p of o.pts)
        porLugar[p.map((x) => x.toFixed(2)).join(",")] = (porLugar[p.map((x) => x.toFixed(2)).join(",")] ?? 0) + 1;
    const [k, n] = Object.entries(porLugar).sort((a, b) => b[1] - a[1])[0];
    test.skip(n <= 6, "ningún lugar tiene más de 6 fichas");
    const c = page.locator(`#markers .cluster[data-grupo="${k}"]`);
    await expect(c).toHaveAttribute("aria-expanded", "false");
    await expect(c.locator("text")).toHaveText(String(n));
    await c.click();
    await expect(page.locator(`#markers .cluster[data-grupo="${k}"]`)).toHaveAttribute("aria-expanded", "true");
    await page.locator(`#markers .cluster[data-grupo="${k}"]`).click();
    await expect(page.locator(`#markers .cluster[data-grupo="${k}"]`)).toHaveAttribute("aria-expanded", "false");
  });
});

test("demo sin conexión (ZL-41): abre desde el archivo, con todas las fichas y sin pedir nada a la red", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const externos: string[] = [];
  page.on("request", (r) => {
    if (!/^(file|data):/.test(r.url())) externos.push(r.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(new URL("../prototype/radar-offline.html", import.meta.url).href);
  await expect(page.locator("#list article")).toHaveCount(total);
  await expect(page.locator(".stamp")).toContainText("Sin conexión");
  await expect(page.locator("#chat-open")).toBeHidden();
  expect(externos).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});

test.describe("WhatsApp", () => {
  test("el número publicado es un celular argentino válido para wa.me", async ({ request }) => {
    const contact = await (await request.get("/data/contact.json")).json();
    expect(String(contact.whatsapp).replace(/\D/g, "")).toMatch(/^549\d{10}$/);
  });

  test("sin número configurado no aparece ningún botón", async ({ page }) => {
    await page.route("**/data/contact.json", (r) => r.fulfill({ json: { whatsapp: "" } }));
    await page.reload();
    await expect(page.locator("#list article")).toHaveCount(total);
    await expect(page.locator("#wa-general")).toBeHidden();
    await expect(page.locator("a.wa[data-wa]")).toHaveCount(0);
  });

  test("con número: botón general y uno por ficha con la consulta escrita", async ({ page }) => {
    await page.route("**/data/contact.json", (r) =>
      r.fulfill({ json: { whatsapp: "+54 9 341 000-0000", nota: "nota" } }),
    );
    await page.reload();
    await expect(page.locator("a.wa[data-wa]")).toHaveCount(total);
    const general = page.locator("#wa-general");
    await expect(general).toBeVisible();
    await expect(general).toHaveAttribute("href", /^https:\/\/wa\.me\/5493410000000\?text=/);

    await page.locator("#pf-res").click();
    const first = data.opportunities[0];
    const href = await page.locator(`a.wa[data-wa="${first.id}"]`).getAttribute("href");
    const text = decodeURIComponent(new URL(href!).searchParams.get("text")!);
    expect(text).toContain(first.t);
    expect(text).toContain(data.profiles.res);
    expect(await general.getAttribute("href")).toContain(encodeURIComponent(data.profiles.res));
  });

  test("un número inválido no rompe la página ni muestra botones", async ({ page }) => {
    await page.route("**/data/contact.json", (r) => r.fulfill({ json: { whatsapp: "123" } }));
    await page.reload();
    await expect(page.locator("#list article")).toHaveCount(total);
    await expect(page.locator("a.wa[data-wa]")).toHaveCount(0);
  });
});

test("en el celular nada es más ancho que la pantalla, aunque no carguen las fuentes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo celular");
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.route("**/data/contact.json", (r) => r.fulfill({ json: { whatsapp: "5493410000000" } }));
  await page.reload();
  await expect(page.locator("#list article")).toHaveCount(total);
  const [client, scroll] = await page.evaluate(() => [
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(client);
});

test.describe("Zustro Labs", () => {
  test("el pie dice de quién es el proyecto y muestra el símbolo", async ({ page }) => {
    const madeBy = page.locator("#made-by");
    await expect(madeBy).toContainText("Zustro Labs");
    await expect(madeBy).toContainText("Ateneo Croata de Rosario");
    const img = madeBy.locator("img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://radar.zustrolabs.com/");
  });

  test("el damero del símbolo arranca en rojo, nunca en blanco", async ({ request }) => {
    const svg = await (await request.get("/assets/zustro-simbolo.svg")).text();
    const first = svg.match(/<rect x="0" y="0"[^>]*fill="([^"]+)"/);
    expect(first?.[1]).toBe("#C8102E");
    expect(svg).not.toMatch(/fill="#(fff|ffffff)"/i);
  });
});

test.describe("Chat con IA", () => {
  const API = "https://api.zustrolabs.com/chat";
  const reply =
    (body: object, status = 200) =>
    (r: import("@playwright/test").Route) =>
      r.fulfill({ status, json: body, headers: { "access-control-allow-origin": "*" } });

  test("sin chat_api configurada no aparece el botón", async ({ page }) => {
    await page.route("**/data/contact.json", (r) => r.fulfill({ json: { whatsapp: "" } }));
    await page.reload();
    await expect(page.locator("#list article")).toHaveCount(total);
    await expect(page.locator("#chat-open")).toBeHidden();
  });

  test("pregunta, respuesta con fichas recomendadas y la ficha se marca en la lista", async ({ page }) => {
    let sent: { messages: { role: string; content: string }[]; perfil: string } | undefined;
    await page.route(API, async (r) => {
      sent = r.request().postDataJSON();
      await reply({
        respuesta: "Te sirve la beca de lengua croata.\nEl curso es gratis.",
        fichas: [{ id: "beca", t: "Beca de lengua croata", src: ["mdu.gov.hr", "https://mdu.gov.hr/"] }],
        derivar_whatsapp: false,
        fuera_de_tema: false,
      })(r);
    });
    await page.locator("#pf-cit").click();
    await page.locator("#chat-open").click();
    await expect(page.locator("#chat")).toBeVisible();
    await expect(page.locator("#chat-input")).toBeFocused();
    await page.locator("#chat-input").fill("¿Hay becas para estudiar croata?");
    await page.keyboard.press("Enter");
    await expect(page.locator(".msg-bot").last()).toContainText("Te sirve la beca");
    expect(sent!.perfil).toBe("cit");
    expect(sent!.messages.at(-1)).toEqual({ role: "user", content: "¿Hay becas para estudiar croata?" });
    await page.locator(".chat-ficha", { hasText: "Beca de lengua croata" }).click();
    await expect(page.locator("#card-beca")).toHaveClass(/sel/);
  });

  test("la respuesta se muestra como texto (no ejecuta HTML) y ofrece WhatsApp si hace falta", async ({ page }) => {
    await page.route(
      API,
      reply({
        respuesta: '<img src=x onerror="window.__x=1">No lo tengo.',
        fichas: [],
        derivar_whatsapp: true,
        fuera_de_tema: false,
      }),
    );
    await page.locator("#chat-open").click();
    await page.locator(".chat-sug").first().click();
    const bot = page.locator(".msg-bot").last();
    await expect(bot).toContainText("<img src=x");
    expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    await expect(bot.locator("a.msg-wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/5493413350686\?text=/);
  });

  test("si el servidor falla, avisa sin romper la página y se puede volver a preguntar", async ({ page }) => {
    let n = 0;
    await page.route(API, (r) =>
      ++n === 1
        ? reply({ error: "El asistente no está disponible en este momento." }, 502)(r)
        : reply({ respuesta: "Ahora sí.", fichas: [], derivar_whatsapp: false, fuera_de_tema: false })(r),
    );
    await page.locator("#chat-open").click();
    await page.locator("#chat-input").fill("hola");
    await page.locator("#chat-send").click();
    await expect(page.locator(".msg-error")).toContainText("no está disponible");
    await page.locator("#chat-input").fill("hola de nuevo");
    await page.locator("#chat-send").click();
    await expect(page.locator(".msg-bot").last()).toContainText("Ahora sí.");
  });

  test("el contador de caracteres avisa cerca del límite y el texto no pasa de 800", async ({ page }) => {
    await page.locator("#chat-open").click();
    await page.locator("#chat-input").fill("hola");
    await expect(page.locator("#chat-count")).toHaveText("4/800");
    await page.locator("#chat-input").fill("x".repeat(900));
    await expect(page.locator("#chat-count")).toHaveText("800/800");
    await expect(page.locator("#chat-count")).toHaveClass(/near/);
  });

  test("después de 12 preguntas sugiere seguir con una persona", async ({ page }) => {
    await page.route(API, reply({ respuesta: "Ok.", fichas: [], derivar_whatsapp: false, fuera_de_tema: false }));
    await page.locator("#chat-open").click();
    for (let i = 1; i <= 12; i++) {
      await page.locator("#chat-input").fill(`pregunta ${i}`);
      await page.locator("#chat-send").click();
      await expect(page.locator(".msg-user")).toHaveCount(i);
      await expect(page.locator("#chat-send")).toBeEnabled();
    }
    await expect(page.locator(".msg-note")).toContainText("La charla ya es larga");
    await expect(page.locator(".msg-note a.msg-wa")).toBeVisible();
  });

  test("el pie lleva a la página de privacidad, con cómo borrar los datos", async ({ page }) => {
    await page.locator("#made-by a", { hasText: "Privacidad" }).click();
    await expect(page).toHaveURL(/privacidad\.html$/);
    await expect(page.locator("h1")).toHaveText("Privacidad");
    await expect(page.locator("#borrar")).toContainText("BORRAR");
    await expect(page.locator("#borrar a[href^='mailto:hola@zustrolabs.com']")).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(wide).toBe(false);
  });

  test("el link «Cómo responde el asistente» lleva a la política publicada", async ({ page }) => {
    await page.locator("#chat-open").click();
    await page.locator(".chat-note a", { hasText: "Cómo responde el asistente" }).click();
    await expect(page).toHaveURL(/asistente\.html$/);
    await expect(page.locator("h1")).toHaveText("Cómo responde el asistente");
    for (const h of ["Temas que sí toma", "Temas que no toma", "Temas sensibles", "Límites", "Privacidad"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.locator("#politica")).toContainText("911");
    const [client, scroll] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(client);
  });

  test("Escape cierra el chat y devuelve el foco al botón", async ({ page }) => {
    await page.locator("#chat-open").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#chat")).toBeHidden();
    await expect(page.locator("#chat-open")).toBeFocused();
  });

  test("en el celular el chat abierto entra en la pantalla", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo celular");
    await page.locator("#chat-open").click();
    const box = await page.locator("#chat").boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    const [client, scroll] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(client);
  });
});
