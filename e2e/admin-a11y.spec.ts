import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Accessibility on the sign-in page and key admin screens (docs/08 Phase 5).
// Signed-in screens need a staff account on the e2e deployment:
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm e2e
// Without them, only the sign-in page is checked.

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const SCREENS = [
  ["Today", "/admin"],
  ["Reservations", "/admin/reservations"],
  ["Availability", "/admin/availability"],
  ["Rooms & rates", "/admin/rooms"],
  ["Content", "/admin/content"],
  ["Inquiries", "/admin/inquiries"],
  ["Settings", "/admin/settings"],
] as const;

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("admin sign-in page is accessible and not indexable", async ({ page }) => {
  const res = await page.goto("/admin/login");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  expect(res?.headers()["x-frame-options"]).toBe("DENY");
  await expect(page.getByLabel("Work email")).toBeVisible();
  expect(await axe(page), "axe violations").toEqual([]);
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/admin/reservations");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Freservations/);
});

test.describe("signed-in admin screens", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to check signed-in screens");
  test.describe.configure({ mode: "serial" });

  test("key screens pass axe", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/admin/login");
    await page.getByLabel("Work email").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });

    const failures: string[] = [];
    for (const [name, path] of SCREENS) {
      await page.goto(path);
      await expect(page.locator("main h1, h1").first()).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      const v = await axe(page);
      if (v.length) failures.push(`${name}: ${v.join("; ")}`);
    }
    expect(failures).toEqual([]);
  });
});
