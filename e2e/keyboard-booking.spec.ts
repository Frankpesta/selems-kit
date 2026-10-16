import { expect, test, type Locator, type Page } from "@playwright/test";

// Keyboard-only booking run (docs/08 Phase 5, WCAG 2.1.1). No clicks: Tab to
// each control, type, Space/Enter to activate. Cleans up by cancelling.

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Tab forward until `target` has focus; fails if it is unreachable. */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) {
      // Focus must be visible (WCAG 2.4.7): an outline or a ring box-shadow.
      const visible = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
      });
      expect(visible, "focused control shows a focus indicator").toBe(true);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${target} with the Tab key`);
}

test("a guest can book a room with the keyboard alone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard run is a desktop check");
  test.setTimeout(90_000);
  // Days 361–363: past the per-project bands in booking.spec.ts, inside the 365-day window.
  const offset = 361 + ((Date.now() / 1000) % 3 | 0);
  const checkIn = addDays(new Date(), offset);
  const checkOut = addDays(new Date(), offset + 1);

  await page.goto(`/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=1&children=0`);
  await expect(page.getByRole("heading", { name: "Choose a room" })).toBeVisible();

  const room = page.getByRole("button", { name: /Standard Room/ });
  await tabTo(page, room);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  const fields: [RegExp | string, string][] = [
    ["First name", "Keyboard"],
    ["Last name", "Only"],
    ["Email", `e2e-kb-${Date.now()}@example.com`],
  ];
  for (const [label, value] of fields) {
    await tabTo(page, page.getByLabel(label));
    await page.keyboard.type(value);
  }
  await tabTo(page, page.getByLabel(/^Phone/));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(`080${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`);
  await tabTo(page, page.getByRole("button", { name: "Review booking" }));
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Review and reserve" })).toBeVisible();
  await tabTo(page, page.getByLabel(/I agree to the booking terms/));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Reserve — pay at the hotel" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /You.re booked, Keyboard/ })).toBeVisible({ timeout: 20_000 });

  // Clean up: cancel through the manage link, still by keyboard.
  await tabTo(page, page.getByRole("link", { name: "Manage booking" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Reserved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await tabTo(page, page.getByRole("button", { name: "Cancel booking" }));
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("button", { name: "Yes, cancel it" });
  await tabTo(page, confirm, 10);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Your booking is cancelled/)).toBeVisible({ timeout: 15_000 });
});
