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
    },
  },
});
