import { test, expect } from "@playwright/test";
import data from "../site/data/opportunities.json" with { type: "json" };

const total = data.opportunities.length;
const usefulFor = (p: "ar" | "cit" | "res") => data.opportunities.filter(o => o.el[p][0] !== "no").length;

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
  const becas = data.opportunities.filter(o => o.cat === "beca").length;
  await page.locator("#cat-beca").click();
  await expect(page.locator("#cat-beca")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#list article")).toHaveCount(total - becas);
});

test("cada ficha tiene enlace oficial https y fecha de revisión", async ({ page }) => {
  const cards = page.locator("#list article");
  for (let i = 0; i < total; i++) {
    const card = cards.nth(i);
    await expect(card.locator(".src a")).toHaveAttribute("href", /^https:\/\//);
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
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#list article")).toHaveCount(total);
  expect(errors).toEqual([]);
});

test("el texto de los datos se muestra escapado, no como HTML", async ({ page }) => {
  await page.route("**/data/opportunities.json", async route => {
    const body = structuredClone(data);
    body.opportunities[0].t = '<img src=x onerror="window.__xss=1">Prueba';
    await route.fulfill({ json: body });
  });
  await page.reload();
  await expect(page.locator("#list")).toContainText('<img src=x onerror="window.__xss=1">Prueba');
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
});

test("las convocatorias cerradas van al final de la lista", async ({ page }) => {
  const closed = data.opportunities.filter(o => "deadline" in o && o.deadline && new Date(o.deadline) < new Date()).length;
  test.skip(closed === 0, "no hay convocatorias cerradas en los datos");
  const pills = await page.locator("#list article").evaluateAll(cards => cards.map(c => c.querySelector(".pill")?.textContent ?? ""));
  const firstClosed = pills.findIndex(t => t.includes("Cerrada"));
  expect(firstClosed).toBe(total - closed);
});
