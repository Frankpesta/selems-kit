import { expect, test } from "@playwright/test";

// Launch gates (docs/08 Phase 5): security headers on every response, and no
// unconfirmed facts or template placeholders in any public page's HTML.

const PAGES = ["/", "/rooms", "/rooms/vip-suite", "/dining", "/facilities", "/gallery", "/contact", "/akure-guide", "/offers", "/privacy", "/terms"];

test.describe("launch checks", () => {
  for (const path of PAGES) {
    test(`headers and content: ${path}`, async ({ request }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "runs once");
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"]).toContain("object-src 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");

      const html = await res.text();
      expect(html, "unconfirmed facts must not ship (CLAUDE.md rule 7)").not.toContain("[CONFIRM]");
      expect(html).not.toMatch(/lorem ipsum|TODO|265 sqm|355 sqm|facebok\.com|linkedln\.com/i);
      expect(html).toContain('type="application/ld+json"');
    });
  }

  test("the CSP lets the site run without console violations", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "runs once");
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    for (const path of ["/", "/rooms/vip-suite", "/contact", "/gallery", "/book"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    expect(violations).toEqual([]);
  });

  // JS budget (CLAUDE.md rule 9, as revised in docs/03): gzipped script loaded
  // before the load event. Route prefetches after load are excluded on purpose.
  const JS_BUDGET_KB: Record<string, number> = { "/": 240, "/rooms": 260, "/rooms/vip-suite": 240, "/contact": 270, "/book": 300 };
  for (const [path, budget] of Object.entries(JS_BUDGET_KB)) {
    test(`initial JS within ${budget} KB: ${path}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "runs once, on the phone profile");
      await page.goto(path);
      await page.waitForLoadState("load");
      const kb = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const scripts = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
          (e) => (e.initiatorType === "script" || e.name.endsWith(".js")) && e.startTime <= nav.loadEventEnd,
        );
        return Math.round(scripts.reduce((sum, e) => sum + e.transferSize, 0) / 1024);
      });
      testInfo.annotations.push({ type: "js-kb", description: `${path}: ${kb} KB` });
      expect(kb, `${path} initial JS (KB, gzipped)`).toBeLessThanOrEqual(budget);
    });
  }
});
