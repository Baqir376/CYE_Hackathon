import { expect, test } from "@playwright/test";
import { runSample, steps, watchErrors } from "./helpers";

test("the story plays by itself and can be paused", async ({ page }) => {
  await page.goto("/?nointro");
  await page.locator("#story").scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById("story")!.scrollIntoView({ behavior: "instant" }));
  const bar = (n: string) => page.getByRole("button", { name: `Show ${n}` });
  await expect(bar("Pages")).toHaveAttribute("aria-current", "true");
  await expect(bar("Read")).toHaveAttribute("aria-current", "true", { timeout: 9000 });
  await expect(bar("Trace")).toHaveAttribute("aria-current", "true", { timeout: 9000 });
  await page.getByRole("button", { name: "Pause animation" }).click();
  await page.waitForTimeout(6500);
  await expect(bar("Trace")).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Play animation" }).click();
  await expect(bar("Memo")).toHaveAttribute("aria-current", "true", { timeout: 9000 });
});

test("the side line follows the scroll and jumps to sections", async ({ page }) => {
  await page.goto("/?nointro");
  const line = page.getByRole("navigation", { name: "Page sections" });
  const tip = () => line.locator("circle").last().evaluate((c) => Number(c.getAttribute("cy")));
  await expect(line).toBeVisible();
  const before = await tip();
  await page.mouse.wheel(0, 3000);
  await expect.poll(tip).toBeGreaterThan(before + 60);
  await line.getByRole("link", { name: "Features" }).click();
  await expect(line.getByRole("link", { name: "Features" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: /Not a summary bot/ })).toBeInViewport();
});

test("the loupe tours by itself, follows the mouse, and finds the mistake", async ({ page }) => {
  await page.goto("/?nointro");
  const hud = page.getByRole("group", { name: "What the glass is showing" });
  await expect(hud).toContainText("1,420,000");
  await expect(hud).toContainText("Goes to Trade receivables");
  await expect(hud).toContainText("Off by 10,000", { timeout: 20_000 });
  await page.getByRole("button", { name: "Pause tour" }).click();
  const before = await hud.textContent();
  await page.waitForTimeout(5000);
  expect(await hud.textContent()).toBe(before);
  const box = (await page.getByTestId("paper").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.35, { steps: 10 });
  await expect(hud).not.toContainText("Off by 10,000");
});

test("nothing blurry moves in the background", async ({ page }) => {
  for (const u of ["/?nointro", "/app", "/app/cases", "/app/guide", "/how-it-works"]) {
    await page.goto(u);
    await page.waitForTimeout(1500);
    // only the 3D story and the crisp spiral lines may be canvases; no blurred or blended layer may follow the mouse
    expect(await page.locator("canvas:not([data-engine]):not([data-weave])").count(), u).toBe(0);
    expect(await page.locator(".mix-blend-soft-light.fixed").count(), u).toBe(0);
    await page.evaluate(() => scrollTo(0, 0));
    const moving = await page.evaluate(async () => {
      const big = () => [...document.querySelectorAll<HTMLElement>("body *")].filter((e) => { const s = getComputedStyle(e); return /blur/.test(s.filter) || (s.borderRadius === "9999px" && e.offsetWidth > 250); }).map((e) => e.getBoundingClientRect()).map((r) => [r.x, r.y].map(Math.round).join());
      const a = big().join(); await new Promise((r) => setTimeout(r, 1500)); return a !== big().join();
    });
    expect(moving, u).toBe(false);
  }
});

test("stress lab: presets break limits, reset restores, the river can be dragged", async ({ page }) => {
  await runSample(page);
  await expect(page.getByRole("heading", { name: /Sales can fall 2.4% before interest cover breaks the limit/ })).toBeVisible();
  await page.getByRole("button", { name: "Stress test it" }).click();
  await page.getByRole("button", { name: "All three" }).click();
  await expect(page.getByRole("heading", { name: /limits broken/ })).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("heading", { name: /Sales can fall 2.4%/ })).toBeVisible();
  const h = (await page.getByTestId("sales-handle").boundingBox())!;
  await page.mouse.move(h.x + 45, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 45, h.y + h.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("slider", { name: /^Sales/ })).toHaveAttribute("aria-valuetext", /down/);
  await page.getByRole("slider", { name: /^Borrowing rate/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider", { name: /^Borrowing rate/ })).toHaveAttribute("aria-valuetext", /0.05 points/);
  await page.getByRole("button", { name: /^Finance cost/ }).getByText("Finance cost").click();
  await expect(page.getByAltText("Source page 4")).toBeVisible();
  // a scenario must never leak into the case
  await page.getByRole("button", { name: /^Ratios/ }).click();
  await expect(page.getByText("1.58x").first()).toBeVisible();
});

test("the source page has a magnifier", async ({ page }) => {
  await runSample(page);
  await page.getByText("Negative operating cash flow").first().click();
  const img = page.getByAltText("Source page 5");
  await expect(img).toBeVisible();
  await page.waitForTimeout(1500);
  // the pane opens zoomed on the cell, so hover next to the highlight
  const b = (await page.locator(".hl-box").first().boundingBox())!;
  await page.mouse.move(b.x - 40, b.y + b.height / 2, { steps: 5 });
  await expect(page.locator("[data-lens]")).toBeVisible();
});

test("woven edges are still until the mouse crosses them, then settle", async ({ page, isMobile }) => {
  test.skip(isMobile, "needs a mouse");
  await page.goto("/?nointro");
  await page.evaluate(() => { const e = document.querySelector("#proof [data-edge]")!; scrollTo({ top: e.getBoundingClientRect().top + scrollY - 400, behavior: "instant" }); });
  await page.waitForTimeout(1200);
  const d = () => page.locator("#proof [data-edge] g path").first().getAttribute("d");
  const rest = await d();
  await page.waitForTimeout(900);
  expect(await d()).toBe(rest);
  await page.mouse.move(640, 405);
  await page.mouse.move(640, 500, { steps: 6 });
  await expect.poll(d, { intervals: [30] }).not.toBe(rest);
  await page.waitForTimeout(2000);
  expect(await d()).toBe(rest);
});

test("the spirals stand still, lean away from the mouse, and come back", async ({ page, isMobile }) => {
  test.skip(isMobile, "needs a mouse");
  await page.goto("/app");
  await page.waitForTimeout(2600);
  const ink = () => page.locator("canvas[data-weave]").first().evaluate((c: HTMLCanvasElement) => { const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) | 0; return s; });
  const rest = await ink();
  await page.waitForTimeout(1200);
  expect(await ink()).toBe(rest);
  await page.mouse.move(1150, 300);
  await page.mouse.move(1180, 420, { steps: 6 });
  await expect.poll(ink, { intervals: [60] }).not.toBe(rest);
  await page.waitForTimeout(3500);
  expect(await ink()).not.toBe(0);
});

test("the light theme and the woven pattern are on every page", async ({ page }) => {
  for (const u of ["/?nointro", "/app", "/app/cases", "/app/guide", "/how-it-works"]) {
    await page.goto(u);
    await page.waitForTimeout(1200);
    expect(await page.locator("canvas[data-weave]").count(), u).toBeGreaterThan(0);
    const dark = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].filter((e) => { const c = getComputedStyle(e).backgroundColor.match(/[d.]+/g)?.map(Number); return c && (c[3] ?? 1) > 0.5 && e.offsetWidth > innerWidth * 0.6 && e.offsetHeight > 250 && c[0] + c[1] + c[2] < 450; }).length);
    expect(dark, u).toBe(0);
  }
});

test("there are no star shapes left on any page", async ({ page }) => {
  for (const u of ["/?nointro", "/app", "/how-it-works"]) {
    await page.goto(u);
    expect(await page.locator("svg[viewBox='-112 -112 224 224']").count()).toBe(0);
  }
});

test("Ctrl K finds a figure and opens its source", async ({ page }) => {
  const errors = watchErrors(page);
  await runSample(page);
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: /Search figures/ });
  await expect(box).toBeFocused();
  await box.fill("trade receivables");
  await page.keyboard.press("Enter");
  await expect(page.getByAltText("Source page 3")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Search figures/ }).fill("zzzz");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(steps(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("glass panels really blur what is behind them", async ({ page }) => {
  await runSample(page);
  expect(await page.locator(".glass").first().evaluate((e) => getComputedStyle(e).backdropFilter)).toContain("blur");
});

test("the edit window covers the whole screen and is not trapped inside a panel", async ({ page }) => {
  await runSample(page);
  await page.getByRole("button", { name: "Open checks" }).click();
  await page.getByRole("button", { name: /Use re-computed sum/ }).click();
  const r = await page.getByRole("dialog").evaluate((e) => { const b = e.parentElement!.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height), innerWidth, innerHeight]; });
  expect(r[0]).toBeGreaterThanOrEqual(r[2] - 20);
  expect(r[1]).toBe(r[3]);
});
