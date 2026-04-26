import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],

    /**
     * hookTimeout: 120000 (2 minutes)
     * Covers the MongoMemoryServer binary download on first run.
     * After the binary is cached this completes in < 2 seconds.
     *
     * testTimeout: 30000 (30 seconds)
     * Individual tests should never take this long.
     * But model tests with DB operations need more than 5s default.
     */
    hookTimeout: 120000,
    testTimeout: 30000,

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@chatbot/types": path.resolve(
        __dirname,
        "./packages/types/dist/index.js",
      ),
    },
  },
});
