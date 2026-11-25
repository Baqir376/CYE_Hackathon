import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PAGES, runSample } from "./helpers";

async function check(page: Page) {
  await page.waitForTimeout(1500);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " → " + (n.any[0]?.message || "").slice(0, 110)).join(" | ")}`);
  expect(bad).toEqual([]);
}

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const url of PAGES) test(`WCAG 2.1 AA: ${url}`, async ({ page }) => {
  await page.goto(url);
  // bring every scroll-revealed section into its final state
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await check(page);
});

for (const tab of ["Overview", "Spread", "Checks", "Ratios & policy", "Stress test", "Credit memo", "Audit trail"]) test(`WCAG 2.1 AA: workspace, ${tab}`, async ({ page }) => {
  await runSample(page);
  await page.getByRole("button", { name: new RegExp("^" + tab + "( ?[0-9]+)?$") }).last().click();
  await check(page);
});

test("keyboard only: reach the app and start the sample", async ({ page, isMobile }) => {
  test.skip(isMobile, "no keyboard");
  await page.goto("/app");
  const btn = page.getByRole("button", { name: "Run the sample" });
  await expect(btn).toBeEnabled();
  for (let i = 0; i < 25 && !(await btn.evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(btn).toBeFocused();
  expect(await btn.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/cases\//);
});

test("keyboard only: open a source and close the edit window with Escape", async ({ page, isMobile }) => {
  test.skip(isMobile, "no keyboard");
  await runSample(page);
  const fig = page.locator(".evi").first();
  await fig.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByAltText(/^Source page/)).toBeVisible();
  await page.getByRole("button", { name: "Open checks" }).click();
  await page.getByRole("button", { name: /Use re-computed sum/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reduced motion: no WebGL and nothing keeps animating", async ({ page }) => {
  await page.goto("/?nointro");
  await page.waitForTimeout(2500);
  expect(await page.locator("canvas[data-engine]").count()).toBe(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
