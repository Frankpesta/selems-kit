import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// E2E runs against a production build (`next build && next start`), as CI does (docs/08).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    // Cross-browser pass before launch (docs/08 Phase 5): E2E_ALL_BROWSERS=1 pnpm e2e
    // (first: pnpm exec playwright install webkit firefox msedge).
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          { name: "iphone-safari", use: { ...devices["iPhone 15"] } },
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
        ]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start --port ${PORT}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
