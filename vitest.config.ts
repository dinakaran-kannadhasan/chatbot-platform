import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    hookTimeout: 120000,
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      /**
       * Point to source .ts file not compiled dist.
       * Vitest uses Vite which handles TypeScript natively —
       * no need to compile first. This also means changes to
       * types are picked up immediately without rebuilding.
       */
      "@chatbot/types": path.resolve(
        __dirname,
        "./packages/types/src/index.ts",
      ),
    },
  },
});
