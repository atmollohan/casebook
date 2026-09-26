import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig.json sets jsx: "preserve" for Next's compiler, which leaves JSX in the
  // transform output. Vitest parses that output directly, so it needs a real runtime.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next aliases this package at build time. Vitest has no such alias, so importing
      // any module that guards itself with `import "server-only"` would fail to resolve.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
