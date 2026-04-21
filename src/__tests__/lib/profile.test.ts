/**
 * Unit tests for src/lib/profile.ts
 *
 * Uses temp dirs for the project cwd and a stubbed HOME (via os.homedir mock)
 * so the tests never touch the real ~/.sc4sap.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function makeTempHome(): string {
  // SC4SAP_HOME_DIR points directly at the `.sc4sap` directory, so we don't
  // need to nest one more level inside the temp dir.
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sc4sap-home-'));
}
function makeTempCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sc4sap-proj-'));
}

function writeFile(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function writeProfile(home: string, alias: string, envContent: string): string {
  const envPath = path.join(home, 'profiles', alias, 'sap.env');
  writeFile(envPath, envContent);
  return envPath;
}

function writeActivePointer(cwd: string, alias: string): string {
  const p = path.join(cwd, '.sc4sap', 'active-profile.txt');
  writeFile(p, alias);
  return p;
}

function writeLegacy(cwd: string, envContent: string): string {
  const p = path.join(cwd, '.sc4sap', 'sap.env');
  writeFile(p, envContent);
  return p;
}

describe('profile — load and apply', () => {
  const ORIGINAL_ENV = { ...process.env };
  let home: string;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SAP_')) delete process.env[k];
    }
    home = makeTempHome();
    process.env.SC4SAP_HOME_DIR = home;
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns an empty shell when no active-profile and no legacy sap.env exist', () => {
    const cwd = makeTempCwd();
    try {
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.alias).toBeUndefined();
      expect(loaded.envVars).toEqual({});
      expect(loaded.tier).toBe('DEV');
      expect(loaded.readonly).toBe(false);
      expect(loaded.legacy).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('loads legacy sap.env with DEV default when no active-profile pointer exists', () => {
    const cwd = makeTempCwd();
    try {
      writeLegacy(cwd, 'SAP_URL=http://legacy.corp:50000\nSAP_CLIENT=100\n');
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.alias).toBeUndefined();
      expect(loaded.legacy).toBe(true);
      expect(loaded.envVars.SAP_URL).toBe('http://legacy.corp:50000');
      expect(loaded.envVars.SAP_CLIENT).toBe('100');
      expect(loaded.tier).toBe('DEV');
      expect(loaded.readonly).toBe(false);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('loads a user-level profile when active-profile.txt points to it', () => {
    const cwd = makeTempCwd();
    try {
      writeProfile(
        home,
        'HK-DEV',
        'SAP_URL=http://dev.hk.corp:50000\nSAP_CLIENT=100\nSAP_TIER=DEV\nSAP_DESCRIPTION=HK Development\n',
      );
      writeActivePointer(cwd, 'HK-DEV');
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.alias).toBe('HK-DEV');
      expect(loaded.legacy).toBe(false);
      expect(loaded.envVars.SAP_URL).toBe('http://dev.hk.corp:50000');
      expect(loaded.tier).toBe('DEV');
      expect(loaded.readonly).toBe(false);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('marks QA profile as readonly', () => {
    const cwd = makeTempCwd();
    try {
      writeProfile(home, 'HK-QA', 'SAP_URL=http://qa.hk.corp\nSAP_TIER=QA\n');
      writeActivePointer(cwd, 'HK-QA');
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.tier).toBe('QA');
      expect(loaded.readonly).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('marks PRD profile as readonly', () => {
    const cwd = makeTempCwd();
    try {
      writeProfile(
        home,
        'HK-PRD',
        'SAP_URL=http://prd.hk.corp\nSAP_TIER=PRD\n',
      );
      writeActivePointer(cwd, 'HK-PRD');
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.tier).toBe('PRD');
      expect(loaded.readonly).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('accepts lowercase / whitespace in SAP_TIER', () => {
    const cwd = makeTempCwd();
    try {
      writeProfile(home, 'HK-QA', 'SAP_URL=http://qa\nSAP_TIER=  qa  \n');
      writeActivePointer(cwd, 'HK-QA');
      const { loadActiveProfile } = require('../../lib/profile');
      expect(loadActiveProfile(cwd).tier).toBe('QA');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('defaults unknown SAP_TIER values to DEV for backward compatibility', () => {
    const cwd = makeTempCwd();
    try {
      writeProfile(home, 'X', 'SAP_URL=http://x\nSAP_TIER=STG\n');
      writeActivePointer(cwd, 'X');
      const { loadActiveProfile } = require('../../lib/profile');
      expect(loadActiveProfile(cwd).tier).toBe('DEV');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('throws when active-profile.txt points at a missing profile', () => {
    const cwd = makeTempCwd();
    try {
      writeActivePointer(cwd, 'MISSING');
      const { loadActiveProfile } = require('../../lib/profile');
      expect(() => loadActiveProfile(cwd)).toThrow(/MISSING/);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('resolves keychain:<service>/<account> in SAP_PASSWORD', () => {
    const cwd = makeTempCwd();
    try {
      jest.doMock(
        '@napi-rs/keyring',
        () => ({
          Entry: class {
            constructor(
              public service: string,
              public account: string,
            ) {}
            getPassword() {
              if (
                this.service === 'sc4sap' &&
                this.account === 'HK-DEV/DEVELOPER'
              ) {
                return 'RESOLVED_PASSWORD';
              }
              return null;
            }
            setPassword() {
              /* noop */
            }
            deletePassword() {
              return false;
            }
          },
        }),
        { virtual: true },
      );
      writeProfile(
        home,
        'HK-DEV',
        'SAP_URL=http://dev\nSAP_USERNAME=DEVELOPER\nSAP_PASSWORD=keychain:sc4sap/HK-DEV/DEVELOPER\nSAP_TIER=DEV\n',
      );
      writeActivePointer(cwd, 'HK-DEV');
      const { loadActiveProfile } = require('../../lib/profile');
      const loaded = loadActiveProfile(cwd);
      expect(loaded.envVars.SAP_PASSWORD).toBe('RESOLVED_PASSWORD');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('applyProfile overwrites process.env and caches the tier', () => {
    const cwd = makeTempCwd();
    try {
      process.env.SAP_URL = 'http://stale';
      process.env.SAP_TIER = 'DEV';
      writeProfile(
        home,
        'HK-PRD',
        'SAP_URL=http://prd\nSAP_TIER=PRD\nSAP_CLIENT=400\n',
      );
      writeActivePointer(cwd, 'HK-PRD');
      const {
        activateProfile,
        getActiveTier,
        getActiveAlias,
        isReadOnlyTier,
        __resetProfileState,
      } = require('../../lib/profile');
      __resetProfileState();

      const loaded = activateProfile(cwd);
      expect(loaded.alias).toBe('HK-PRD');
      expect(process.env.SAP_URL).toBe('http://prd');
      expect(process.env.SAP_CLIENT).toBe('400');
      expect(process.env.SAP_TIER).toBe('PRD');
      expect(getActiveTier()).toBe('PRD');
      expect(getActiveAlias()).toBe('HK-PRD');
      expect(isReadOnlyTier()).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('applyProfile clears stale SAP_* keys before writing new ones', () => {
    const cwd = makeTempCwd();
    try {
      process.env.SAP_URL = 'http://old';
      process.env.SAP_JWT_TOKEN = 'old-jwt';
      process.env.SAP_INDUSTRY = 'old-industry';
      writeProfile(home, 'X', 'SAP_URL=http://new\nSAP_TIER=DEV\n');
      writeActivePointer(cwd, 'X');
      const {
        activateProfile,
        __resetProfileState,
      } = require('../../lib/profile');
      __resetProfileState();
      activateProfile(cwd);
      expect(process.env.SAP_URL).toBe('http://new');
      // Stale keys wiped:
      expect(process.env.SAP_JWT_TOKEN).toBeUndefined();
      expect(process.env.SAP_INDUSTRY).toBeUndefined();
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
