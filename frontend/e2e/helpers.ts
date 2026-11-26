import { expect, type Page } from "@playwright/test";

/** Fails the test on any uncaught page error or console error. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/WebGL|GPU|GL Driver/i.test(m.text())) errors.push(m.text()); });
  return errors;
}

export const steps = (page: Page) => page.getByRole("list", { name: "What to do next" });

export async function runSample(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Run the sample" }).click();
  await page.waitForURL(/\/app\/cases\/[0-9a-f]{10}$/);
  await expect(steps(page)).toBeVisible({ timeout: 40_000 });
  // the workspace opens on the spreading template; these tests start from Overview
  await page.getByRole("button", { name: /^Overview( ?[0-9]+)?$/ }).click();
}

export const PAGES = ["/?nointro", "/how-it-works", "/app", "/app/cases", "/app/guide"];
