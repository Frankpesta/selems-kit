import { expect, test, type Page } from "@playwright/test";

// Booking acceptance tests (docs/08 Phase 3) against the dev Convex deployment.
// Each run books far-future dates with a unique test email and cancels what it
// booked, so repeated runs don't fill the hotel.

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);

function stayFor(testInfo: { project: { name: string } }, extra = 0) {
  // Spread projects and runs across different dates (30–320 days ahead, inside the 365-day booking window).
  const seed = (Date.now() / 1000) % 97 | 0;
  const offset = 30 + seed + (testInfo.project.name === "phone" ? 150 : 0) + extra;
  const today = new Date();
  return { checkIn: addDays(today, offset), checkOut: addDays(today, offset + 2) };
}

async function fillDetails(page: Page, email: string) {
  await page.getByLabel("First name").fill("Playwright");
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Email").fill(email);
  // Unique number per booking: the per-phone limit is 5 an hour.
  await page.getByLabel(/^Phone/).fill(`080${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`);
  await page.getByRole("button", { name: "Review booking" }).click();
}

async function reserve(page: Page) {
  await expect(page.getByRole("heading", { name: "Review and reserve" })).toBeVisible();
  await page.getByLabel(/I agree to the booking terms/).check();
  await page.getByRole("button", { name: "Reserve — pay at the hotel" }).click();
  await expect(page.getByRole("heading", { name: /You.re booked, Playwright/ })).toBeVisible({ timeout: 20_000 });
  return (await page.getByText(/SLM-\d{2}-\d{4}/).first().innerText()).match(/SLM-\d{2}-\d{4}/)![0];
}

async function cancelFromManageLink(page: Page) {
  await page.getByRole("link", { name: "Manage booking" }).click();
  await expect(page.getByText("Reserved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText(/Your booking is cancelled and the room has been released/)).toBeVisible({ timeout: 15_000 });
}

test("books a room end to end, then the guest cancels it", async ({ page }, testInfo) => {
  const { checkIn, checkOut } = stayFor(testInfo);
  await page.goto(`/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`);

  await expect(page.getByRole("heading", { name: "Choose a room" })).toBeVisible();
  await page.getByRole("button", { name: /Deluxe Room/ }).click();

  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  // Client validation mirrors the server.
  await page.getByRole("button", { name: "Review booking" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await fillDetails(page, `e2e-${Date.now()}@example.com`);

  const ref = await reserve(page);
  expect(ref).toMatch(/^SLM-/);
  await expect(page.getByText("Deluxe Room").first()).toBeVisible();
  // Back must not return to the review step (history entry replaced).
  await cancelFromManageLink(page);
});

test("shows the last room as sold out to the next guest", async ({ page }, testInfo) => {
  const { checkIn, checkOut } = stayFor(testInfo, 40);
  // The Penthouse has a single room: book it via the room-page link (skips step 2).
  await page.goto(`/book?room=penthouse&checkIn=${checkIn}&checkOut=${checkOut}&adults=1&children=0`);
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible({ timeout: 15_000 });
  await fillDetails(page, `e2e-so-${Date.now()}@example.com`);
  await reserve(page);
  const manage = page.getByRole("link", { name: "Manage booking" });
  const manageHref = await manage.getAttribute("href");

  // A second guest follows a link to the same room and dates: told it's gone,
  // shown what's left, with the Penthouse listed as sold out.
  const other = await page.context().newPage();
  await other.goto(`/book?room=penthouse&checkIn=${checkIn}&checkOut=${checkOut}&adults=1&children=0`);
  await expect(other.getByRole("heading", { name: "Choose a room" })).toBeVisible({ timeout: 15_000 });
  await expect(other.getByText("The Penthouse isn't available for these dates")).toBeVisible();
  const penthouse = other.getByRole("button", { name: /Penthouse/ });
  await expect(penthouse).toBeDisabled();
  await expect(penthouse).toContainText("Sold out for these dates");

  // Clean up: cancel, and the second guest sees the room free up live, without
  // being moved off the page they're on.
  await page.goto(manageHref!);
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText(/room has been released/)).toBeVisible({ timeout: 15_000 });
  await expect(penthouse).toBeEnabled({ timeout: 15_000 });
  await expect(other.getByRole("heading", { name: "Choose a room" })).toBeVisible();
});

test("a wrong manage link reveals nothing", async ({ page }) => {
  await page.goto("/booking/SLM-26-0001?t=not-the-token");
  await expect(page.getByRole("heading", { name: "We couldn’t find that booking" })).toBeVisible({ timeout: 15_000 });
});
