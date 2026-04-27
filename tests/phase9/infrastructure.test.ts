import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Infrastructure tests verify the production config is correct.
 * These catch common deployment mistakes before they reach CI:
 * - Missing Dockerfiles
 * - Wrong healthcheck paths
 * - Missing required env vars in docker-compose
 * - CI workflow not configured to run tests
 */

const root = resolve(__dirname, "../..");

describe("Phase 9 — Infrastructure", () => {
  describe("Dockerfiles exist", () => {
    it("apps/api has Dockerfile", () => {
      expect(existsSync(resolve(root, "apps/api/Dockerfile"))).toBe(true);
    });

    it("apps/web has Dockerfile", () => {
      expect(existsSync(resolve(root, "apps/web/Dockerfile"))).toBe(true);
    });

    it(".dockerignore exists at root", () => {
      expect(existsSync(resolve(root, ".dockerignore"))).toBe(true);
    });
  });

  describe("API Dockerfile", () => {
    const dockerfile = readFileSync(
      resolve(root, "apps/api/Dockerfile"),
      "utf-8",
    );

    it("uses multi-stage build", () => {
      expect(dockerfile).toContain("AS builder");
      expect(dockerfile).toContain("AS production");
    });

    it("uses Node 20", () => {
      expect(dockerfile).toContain("node:20-alpine");
    });

    it("creates non-root user", () => {
      expect(dockerfile).toContain("adduser");
    });

    it("has healthcheck", () => {
      expect(dockerfile).toContain("HEALTHCHECK");
    });

    it("exposes port 4000", () => {
      expect(dockerfile).toContain("EXPOSE 4000");
    });

    it("uses frozen lockfile for reproducible installs", () => {
      expect(dockerfile).toContain("--frozen-lockfile");
    });

    it("installs only prod deps in final stage", () => {
      expect(dockerfile).toContain("--prod");
    });
  });

  describe("Web Dockerfile", () => {
    const dockerfile = readFileSync(
      resolve(root, "apps/web/Dockerfile"),
      "utf-8",
    );

    it("uses multi-stage build", () => {
      expect(dockerfile).toContain("AS builder");
      expect(dockerfile).toContain("AS production");
    });

    it("uses Node 20", () => {
      expect(dockerfile).toContain("node:20-alpine");
    });

    it("exposes port 3000", () => {
      expect(dockerfile).toContain("EXPOSE 3000");
    });

    it("has healthcheck", () => {
      expect(dockerfile).toContain("HEALTHCHECK");
    });
  });

  describe(".dockerignore", () => {
    const dockerignore = readFileSync(resolve(root, ".dockerignore"), "utf-8");

    it("excludes node_modules", () => {
      expect(dockerignore).toContain("node_modules");
    });

    it("excludes .env files", () => {
      expect(dockerignore).toContain(".env");
    });

    it("excludes test files", () => {
      expect(dockerignore).toContain("tests");
    });

    it("excludes dist folders", () => {
      expect(dockerignore).toContain("dist");
    });
  });

  describe("docker-compose.yml", () => {
    const compose = readFileSync(resolve(root, "docker-compose.yml"), "utf-8");

    it("exists", () => {
      expect(existsSync(resolve(root, "docker-compose.yml"))).toBe(true);
    });

    it("includes mongodb service", () => {
      expect(compose).toContain("mongodb");
    });

    it("includes redis service", () => {
      expect(compose).toContain("redis");
    });

    it("includes api service", () => {
      expect(compose).toContain("chatbot-api");
    });

    it("includes web service", () => {
      expect(compose).toContain("chatbot-web");
    });

    it("uses healthcheck depends_on", () => {
      expect(compose).toContain("condition: service_healthy");
    });

    it("uses named volumes for persistence", () => {
      expect(compose).toContain("mongodb_data");
      expect(compose).toContain("redis_data");
    });
  });

  describe("GitHub Actions CI", () => {
    const ciPath = resolve(root, ".github/workflows/ci.yml");

    it("ci.yml exists", () => {
      expect(existsSync(ciPath)).toBe(true);
    });

    const ci = readFileSync(ciPath, "utf-8");

    it("runs on push to main", () => {
      expect(ci).toContain("branches: [main");
    });

    it("runs on pull requests", () => {
      expect(ci).toContain("pull_request");
    });

    it("uses Node 20", () => {
      expect(ci).toMatch(/node-version:\s+["']20["']/);
    });

    it("caches pnpm store", () => {
      expect(ci).toContain("pnpm-lock.yaml");
    });

    it("runs pnpm test", () => {
      expect(ci).toContain("pnpm test");
    });

    it("builds Docker images", () => {
      expect(ci).toContain("docker/build-push-action");
    });

    it("docker job requires tests to pass", () => {
      expect(ci).toContain("needs: test");
    });
  });
});
