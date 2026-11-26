import { expect, test } from "@playwright/test";
import { runSample, steps, watchErrors } from "./helpers";

test("an analyst goes from sample to submitted", async ({ page }) => {
  const errors = watchErrors(page);
  await runSample(page);
  await expect(steps(page)).toContainText("Look at 2 failed checks");

  await page.getByRole("button", { name: "Open checks" }).click();
  await page.getByRole("button", { name: /Use re-computed sum/ }).click();
  await expect(page.getByRole("button", { name: "Save & recompute" })).toBeEnabled();
  await page.getByRole("button", { name: "Save & recompute" }).click();
  await expect(steps(page)).toContainText("Everything ties out");
  await expect(steps(page)).toContainText("Redraft the memo");

  await page.getByRole("button", { name: "Redraft now" }).click();
  await expect(steps(page)).not.toContainText("Redraft");
  await expect(page.getByText(/sentences verified/)).toBeVisible();

  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(steps(page)).toContainText("Submitted");
  await expect(page.getByText("Submitted to approver").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a figure opens its page with the exact cell highlighted", async ({ page }) => {
  await runSample(page);
  await page.getByText("Negative operating cash flow").first().click();
  const img = page.getByAltText("Source page 5");
  await expect(img).toBeVisible();
  const box = page.locator(".hl-box").first();
  await expect(box).toBeVisible();
  // read both rectangles in one go: the pane is still smooth-scrolling to the cell
  const [i, b] = await page.evaluate(() => [document.querySelector("img[alt=\"Source page 5\"]")!, document.querySelector(".hl-box")!].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  // the cell is at (0.6577..0.7224, 0.4138..0.4286) of the page
  expect((b!.x + b!.width / 2 - i!.x) / i!.width).toBeCloseTo(0.69, 1);
  expect((b!.y + b!.height / 2 - i!.y) / i!.height).toBeCloseTo(0.421, 1);
});

test("a made-up figure in the memo is blocked and stops submission", async ({ page }) => {
  await runSample(page);
  await page.getByRole("button", { name: "Credit memo" }).click();
  await page.getByRole("button", { name: "Edit section" }).first().click();
  await page.locator("textarea").first().fill("Revenue will reach Rs 6,200 mn next year.");
  await page.getByRole("button", { name: "Save & verify" }).click();
  await expect(page.getByText(/^blocked:/i)).toBeVisible();
  await expect(steps(page)).toContainText("Fix 1 blocked sentence");
});

test("switching browser tabs and reloading keeps the case", async ({ page }) => {
  await runSample(page);
  await page.reload();
  await expect(steps(page)).toContainText("Look at 2 failed checks");
  await page.goto("/app/cases");
  await page.getByRole("link", { name: /Sutlej Demo Textiles/ }).first().click();
  await expect(steps(page)).toBeVisible();
});

test("a fresh sample lands on the template with the document beside it, and a highlight opens the focus view", async ({ page, isMobile }) => {
  test.skip(isMobile, "the document pane sits beside the template on wide screens");
  await page.goto("/app");
  await page.getByRole("button", { name: "Run the sample" }).click();
  await expect(page.getByRole("button", { name: /^Spread$/ })).toHaveClass(/text-white/, { timeout: 40_000 });
  await expect(page.getByText("Source document")).toBeVisible();
  await page.getByRole("row").filter({ hasText: "Trade receivables" }).locator(".evi").first().click();
  await expect(page.getByRole("button", { name: /180%/ })).toBeVisible();
  await page.getByRole("button", { name: "Inspect highlight" }).click();
  const dlg = page.getByRole("dialog", { name: /^Focus view/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByAltText("Focused view of page 3")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dlg.getByAltText("Focused view of page 4")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});
