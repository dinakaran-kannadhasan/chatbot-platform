import { vi } from "vitest";

/**
 * setupFiles runs inside each worker before each test file.
 * env vars are already set by globalSetup.ts.
 * This file only handles per-test mocks.
 */
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit called with code ${String(code)}`);
});
