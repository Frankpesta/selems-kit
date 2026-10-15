import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          // The first test in a file loads every Convex module (cold: several seconds).
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
