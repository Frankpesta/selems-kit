/// <reference types="vite/client" />
// Convex function modules for convex-test (docs.convex.dev/testing/convex-test).
// Lives outside convex/ so the Convex bundler never tries to deploy it.
// Plain include/exclude globs: Vite 8 does not match the docs' extglob pattern.
export const modules = import.meta.glob([
  "../convex/**/*.ts",
  "../convex/**/*.tsx",
  "../convex/**/*.js",
  "!../convex/**/*.test.ts",
  "!../convex/**/*.test.tsx",
  "!../convex/**/*.d.ts",
]);
