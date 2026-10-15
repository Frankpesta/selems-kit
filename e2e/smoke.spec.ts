import { expect, test } from "@playwright/test";

test("home renders with one h1 and the Lagos locale", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NG");
});
