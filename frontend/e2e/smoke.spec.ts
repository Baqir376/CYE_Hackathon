import { expect, test } from "@playwright/test";
import path from "node:path";
import { PAGES, watchErrors } from "./helpers";

for (const url of PAGES) {
  test(`${url} loads cleanly and fits the screen`, async ({ page }) => {
    const errors = watchErrors(page);
    const r = await page.goto(url);
    expect(r!.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("every internal link works", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const url of PAGES) {
    await page.goto(url);
    for (const h of await page.locator("a[href^='/']").evaluateAll((a) => a.map((x) => x.getAttribute("href")!))) seen.add(h.split("#")[0] || "/");
  }
  for (const h of seen) expect((await request.get(h)).status(), h).toBe(200);
});

test("old case links still work", async ({ page }) => {
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/app\/cases$/);
});

test("the opening animation ends by itself and plays only once", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("div.fixed.inset-0.z-\\[100\\]")).toHaveCount(0, { timeout: 6000 });
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator("div.fixed.inset-0.z-\\[100\\]")).toHaveCount(0);
});

test("spot the mistake: wrong guess, then the right one", async ({ page }) => {
  await page.goto("/?nointro");
  await page.getByRole("button", { name: "Start the clock" }).click();
  await page.getByRole("button", { name: /^Equity subtotal/ }).click();
  await expect(page.getByText("adds up fine")).toBeVisible();
  await page.getByRole("button", { name: /^Current liabilities subtotal/ }).click();
  await expect(page.getByText("Off by 10,000")).toBeVisible();
  await expect(page.getByText(/with 1 wrong guess/)).toBeVisible();
});

test("a file that is not a PDF is refused with a reason", async ({ page }) => {
  await page.goto("/app");
  await page.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByRole("alert").filter({ hasText: "Only PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a PDF to start" })).toBeDisabled();
});

test("a fake PDF is analysed, fails, and says why", async ({ page }) => {
  await page.goto("/app");
  await page.locator("input[type=file]").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 broken") });
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page.getByText(/damaged and can't be opened/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Try another document" })).toBeVisible();
});

test("a real upload works end to end", async ({ page }) => {
  await page.goto("/app");
  await page.locator("input[type=file]").setInputFiles(path.join(__dirname, "../../backend/samples/sutlej_demo_textiles.pdf"));
  await page.getByLabel(/Facility requested/).fill("Term loan, Rs 300 mn");
  await page.getByLabel(/Credit policy/).selectOption("sme_conservative");
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page.getByRole("heading", { name: "Sutlej Demo Textiles (Private) Limited" }).first()).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Term loan, Rs 300 mn").first()).toBeVisible({ timeout: 20_000 });
});

test("a case that does not exist shows a message, not a blank page", async ({ page }) => {
  await page.goto("/app/cases/0000000000");
  await expect(page.getByText(/not found/i).first()).toBeVisible();
});

test("when the server is down the app says so", async ({ page }) => {
  await page.route("**/api/**", (r) => r.abort());
  await page.goto("/app");
  await expect(page.getByRole("alert").filter({ hasText: "isn't responding" })).toBeVisible();
  await page.goto("/app/cases");
  await expect(page.getByText(/isn't responding/)).toBeVisible();
});
