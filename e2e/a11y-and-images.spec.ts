import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Accessibility (axe, WCAG 2.2 AA) and image health on every public page (docs/08 Phase 5).
const PAGES = ["/", "/rooms", "/rooms/vip-suite", "/rooms/standard-room", "/dining", "/facilities", "/gallery", "/contact", "/akure-guide", "/offers", "/offers/long-weekend", "/privacy", "/terms", "/book", "/this-page-does-not-exist"];

for (const path of PAGES) {
  test(`a11y + images: ${path}`, async ({ page }) => {
    test.setTimeout(90_000);
    const failed: string[] = [];
    page.on("response", (r) => {
      const u = r.url();
      if ((u.includes("/_next/image") || u.includes("/images/") || u.includes("/icon") || u.includes("favicon")) && r.status() >= 400) {
        failed.push(`${r.status()} ${u}`);
      }
    });
    await page.goto(path);
    await page.waitForLoadState("load");

    // Scroll through so lazy images load and scroll reveals finish.
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1200);

    // Every <img> on the page has actually decoded.
    const broken = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("img")];
      const wait = (i: HTMLImageElement) =>
        Promise.race([i.decode().catch(() => null), new Promise((r) => setTimeout(r, 5000))]);
      await Promise.all(imgs.map((i) => (i.complete ? null : wait(i))));
      // Images inside a closed lightbox <dialog> are never requested; skip them.
      return imgs
        .filter((i) => !i.closest("dialog:not([open])"))
        .filter((i) => i.naturalWidth === 0)
        .map((i) => i.getAttribute("src") ?? "?");
    });
    expect(broken, "images that failed to load").toEqual([]);
    expect(failed, "image requests that failed").toEqual([]);

    // Every image has alt text (decorative ones use alt="").
    const missingAlt = await page.locator("img:not([alt])").count();
    expect(missingAlt).toBe(0);

    // One h1 per page.
    await expect(page.locator("h1")).toHaveCount(1);

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, "axe violations").toEqual([]);
  });
}
