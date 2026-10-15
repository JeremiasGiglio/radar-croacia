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
  await page.locator("#markers .mk").first().click();
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
