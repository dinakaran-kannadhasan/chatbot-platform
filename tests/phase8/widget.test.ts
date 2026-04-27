import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Phase 8 tests verify the widget package structure.
 *
 * Full E2E widget tests (mounting in a real browser, testing
 * Shadow DOM isolation, cross-site embedding) belong in
 * Playwright tests — Phase 9.
 *
 * Here we verify:
 * 1. All required source files exist
 * 2. Package configuration is correct for a widget bundle
 * 3. Vite config has the correct IIFE output format
 */

const widgetRoot = resolve(__dirname, "../../apps/widget");

describe("Phase 8 — Widget Package", () => {
  describe("source files exist", () => {
    const requiredFiles = [
      "src/embed.ts",
      "src/Widget.tsx",
      "src/store/widgetStore.ts",
      "src/widget.css",
      "vite.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      "package.json",
      "tsconfig.json",
    ];

    requiredFiles.forEach((file) => {
      it(`has ${file}`, () => {
        expect(existsSync(resolve(widgetRoot, file))).toBe(true);
      });
    });
  });

  describe("package.json configuration", () => {
    const pkg = JSON.parse(
      require("fs").readFileSync(resolve(widgetRoot, "package.json"), "utf-8"),
    ) as Record<string, unknown>;

    it("has correct name", () => {
      expect(pkg["name"]).toBe("@chatbot/widget");
    });

    it("has build script", () => {
      const scripts = pkg["scripts"] as Record<string, string>;
      expect(scripts["build"]).toBeDefined();
    });

    it("is private", () => {
      expect(pkg["private"]).toBe(true);
    });
  });

  describe("vite config", () => {
    const viteConfig = require("fs").readFileSync(
      resolve(widgetRoot, "vite.config.ts"),
      "utf-8",
    ) as string;

    it("uses IIFE format", () => {
      expect(viteConfig).toContain("iife");
    });

    it("uses embed.ts as entry point", () => {
      expect(viteConfig).toContain("embed.ts");
    });

    it("sets output filename to chatbot", () => {
      expect(viteConfig).toContain("chatbot");
    });
  });

  describe("embed.ts configuration", () => {
    const embed = require("fs").readFileSync(
      resolve(widgetRoot, "src/embed.ts"),
      "utf-8",
    ) as string;

    it("reads websiteId from data attribute", () => {
      expect(embed).toContain("data-website-id");
    });

    it("uses Shadow DOM for isolation", () => {
      expect(embed).toContain("attachShadow");
    });

    it("handles DOM not ready state", () => {
      expect(embed).toContain("DOMContentLoaded");
    });

    it("reads primary color from data attribute", () => {
      expect(embed).toContain("data-primary-color");
    });

    it("reads api url from data attribute", () => {
      expect(embed).toContain("data-api-url");
    });
  });

  describe("Widget.tsx", () => {
    const widget = require("fs").readFileSync(
      resolve(widgetRoot, "src/Widget.tsx"),
      "utf-8",
    ) as string;

    it("uses ReadableStream for SSE parsing", () => {
      // Widget reads SSE via fetch + ReadableStream, not EventSource
      // The server sets Content-Type: text/event-stream
      // The client reads it via response.body.getReader()
      expect(widget).toContain("getReader");
    });

    it("handles abort controller", () => {
      expect(widget).toContain("AbortController");
    });

    it("parses SSE data lines", () => {
      expect(widget).toContain("data: ");
    });
  });

  describe("widgetStore.ts", () => {
    const store = require("fs").readFileSync(
      resolve(widgetRoot, "src/store/widgetStore.ts"),
      "utf-8",
    ) as string;

    it("uses zustand", () => {
      expect(store).toContain("zustand");
    });

    it("has updateLastMessage for streaming", () => {
      expect(store).toContain("updateLastMessage");
    });

    it("tracks intentLevel", () => {
      expect(store).toContain("intentLevel");
    });
  });
});
