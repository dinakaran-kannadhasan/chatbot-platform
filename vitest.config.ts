import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // globalSetup runs before any worker starts
    // This guarantees process.env is set before any module loads
    globalSetup: ["./tests/globalSetup.ts"],
    // setupFiles still runs per-file for mocks like vi.spyOn
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
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
