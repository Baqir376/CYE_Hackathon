import { expect, test } from "@playwright/test";
import { runSample } from "./helpers";

// Visual regression: pixel-compare with stored screenshots. Update on purpose with: npx playwright test visual --update-snapshots
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("home, top", async ({ page }) => {
  await page.goto("/?nointro");
  await page.waitForTimeout(3000);
  await expect(page).toHaveScreenshot("home.png");
});

test("guide", async ({ page }) => {
  await page.goto("/app/guide");
  await expect(page).toHaveScreenshot("guide.png");
});

test("workspace overview", async ({ page }) => {
  await runSample(page);
  await page.waitForTimeout(3500);
  await expect(page).toHaveScreenshot("workspace.png", { mask: [page.locator(".num")] });
});

test("3D hero renders and stays smooth", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100/?nointro&force3d");
  await page.evaluate(() => document.getElementById("story")!.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator("canvas[data-engine]")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(() => new Promise<number>((r) => { let n = 0; const t = performance.now(); (function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / 2); })(); }));
  console.log("3D fps", Math.round(fps));
  expect(fps).toBeGreaterThan(Number(process.env.MIN_FPS || 20));
  await ctx.close();
});
