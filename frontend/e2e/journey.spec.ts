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
  const [i, b] = [await img.boundingBox(), await box.boundingBox()];
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
