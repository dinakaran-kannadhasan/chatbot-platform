import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const exists = (filePath: string) => fs.existsSync(path.join(root, filePath));
const readJson = (filePath: string) =>
  JSON.parse(fs.readFileSync(path.join(root, filePath), 'utf-8'));

describe('Phase 1 — Monorepo Structure', () => {

  describe('Root config files exist', () => {
    it('has package.json at root', () => {
      expect(exists('package.json')).toBe(true);
    });

    it('has pnpm-workspace.yaml', () => {
      expect(exists('pnpm-workspace.yaml')).toBe(true);
    });

    it('has turbo.json', () => {
      expect(exists('turbo.json')).toBe(true);
    });

    it('has .gitignore', () => {
      expect(exists('.gitignore')).toBe(true);
    });

    it('has .env.example', () => {
      expect(exists('.env.example')).toBe(true);
    });

    it('does NOT have .env committed', () => {
      const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('.env');
    });
  });

  describe('App workspaces exist', () => {
    const apps = ['apps/api', 'apps/web', 'apps/widget'];

    apps.forEach(app => {
      it(`${app} has package.json`, () => {
        expect(exists(`${app}/package.json`)).toBe(true);
      });

      it(`${app} has tsconfig.json`, () => {
        expect(exists(`${app}/tsconfig.json`)).toBe(true);
      });

      it(`${app} package.json has correct name prefix`, () => {
        const pkg = readJson(`${app}/package.json`);
        expect(pkg.name).toMatch(/^@chatbot\//);
      });

      it(`${app} package.json is private`, () => {
        const pkg = readJson(`${app}/package.json`);
        expect(pkg.private).toBe(true);
      });
    });
  });

  describe('Package workspaces exist', () => {
    const packages = ['packages/types', 'packages/config'];

    packages.forEach(pkg => {
      it(`${pkg} has package.json`, () => {
        expect(exists(`${pkg}/package.json`)).toBe(true);
      });

      it(`${pkg} package.json has correct name prefix`, () => {
        const pkgJson = readJson(`${pkg}/package.json`);
        expect(pkgJson.name).toMatch(/^@chatbot\//);
      });
    });
  });

  describe('Workspace dependencies are linked', () => {
    it('apps/api depends on @chatbot/types', () => {
      const pkg = readJson('apps/api/package.json');
      expect(pkg.dependencies?.['@chatbot/types']).toBe('workspace:*');
    });

    it('apps/web depends on @chatbot/types', () => {
      const pkg = readJson('apps/web/package.json');
      expect(pkg.dependencies?.['@chatbot/types']).toBe('workspace:*');
    });

    it('apps/widget depends on @chatbot/types', () => {
      const pkg = readJson('apps/widget/package.json');
      expect(pkg.dependencies?.['@chatbot/types']).toBe('workspace:*');
    });
  });

  describe('Turbo pipeline is valid', () => {
    it('turbo.json has build pipeline', () => {
      const turbo = readJson('turbo.json');
      expect(turbo.pipeline?.build).toBeDefined();
    });

    it('turbo.json build depends on upstream builds', () => {
      const turbo = readJson('turbo.json');
      expect(turbo.pipeline.build.dependsOn).toContain('^build');
    });

    it('turbo.json has dev pipeline', () => {
      const turbo = readJson('turbo.json');
      expect(turbo.pipeline?.dev).toBeDefined();
    });

    it('turbo.json dev is not cached', () => {
      const turbo = readJson('turbo.json');
      expect(turbo.pipeline.dev.cache).toBe(false);
    });
  });

  describe('pnpm-workspace.yaml is valid', () => {
    it('includes apps/* glob', () => {
      const workspace = fs.readFileSync(
        path.join(root, 'pnpm-workspace.yaml'),
        'utf-8'
      );
      // Check for the value regardless of quote style (single or double)
      expect(workspace).toContain('apps/*');
    });

    it('includes packages/* glob', () => {
      const workspace = fs.readFileSync(
        path.join(root, 'pnpm-workspace.yaml'),
        'utf-8'
      );
      // Check for the value regardless of quote style (single or double)
      expect(workspace).toContain('packages/*');
    });
  });

});
