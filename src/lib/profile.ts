/**
 * Multi-profile SAP connection management.
 *
 * Resolves an "active profile" from the project-local pointer file
 * `<cwd>/.sc4sap/active-profile.txt`, loads the corresponding profile env
 * from `~/.sc4sap/profiles/<alias>/sap.env`, and overwrites `process.env.SAP_*`
 * so the rest of the server (connection factory, handlers) observes the
 * selected system transparently.
 *
 * When no active-profile.txt is present, falls back to the legacy
 * `<cwd>/.sc4sap/sap.env`. In legacy mode, SAP_TIER defaults to 'DEV' so
 * existing single-profile users retain their previous (permissive) behavior.
 *
 * Keychain references in SAP_PASSWORD (`keychain:<service>/<account>`) are
 * resolved via @napi-rs/keyring at load time. See ./secrets.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { resolveSecret } from './secrets';

export type Tier = 'DEV' | 'QA' | 'PRD';

export interface LoadedProfile {
  /** Alias as written in active-profile.txt, or `undefined` for legacy single-profile mode. */
  alias: string | undefined;
  /** Absolute path of the env file that was loaded. */
  sourcePath: string;
  /** Parsed env variables (password already resolved if keychain-backed). */
  envVars: Record<string, string>;
  /** Resolved tier (defaults to DEV if SAP_TIER is missing). */
  tier: Tier;
  /** True if the profile is read-only (tier !== DEV). */
  readonly: boolean;
  /** True when loaded via the legacy single-profile fallback. */
  legacy: boolean;
}

/** Module-level cache of the currently-active tier, read by the guard. */
let activeTier: Tier = 'DEV';
let activeAlias: string | undefined;

/** Keys that are wiped on apply before the new profile is written in. */
const SAP_ENV_KEYS_TO_CLEAR = [
  'SAP_URL',
  'SAP_CLIENT',
  'SAP_AUTH_TYPE',
  'SAP_USERNAME',
  'SAP_PASSWORD',
  'SAP_LANGUAGE',
  'SAP_SYSTEM_TYPE',
  'SAP_VERSION',
  'ABAP_RELEASE',
  'SAP_INDUSTRY',
  'SAP_ACTIVE_MODULES',
  'SAP_RFC_BACKEND',
  'SAP_CONNECTION_TYPE',
  'SAP_TIER',
  'SAP_DESCRIPTION',
  'SAP_JWT_TOKEN',
  'SAP_REFRESH_TOKEN',
  'SAP_UAA_URL',
  'SAP_UAA_CLIENT_ID',
  'SAP_UAA_CLIENT_SECRET',
  'SAP_MASTER_SYSTEM',
  'SAP_RESPONSIBLE',
  'MCP_BLOCKLIST_PROFILE',
  'MCP_BLOCKLIST_EXTEND',
  'MCP_ALLOW_TABLE',
];

function sc4sapHomeDir(): string {
  // Optional override for tests and custom installs. Value is the .sc4sap
  // directory itself (not the parent home), so `~/.sc4sap` becomes
  // `$SC4SAP_HOME_DIR`.
  const override = process.env.SC4SAP_HOME_DIR;
  if (override) return override;
  return path.join(os.homedir(), '.sc4sap');
}

function activeProfileFile(cwd: string): string {
  return path.join(cwd, '.sc4sap', 'active-profile.txt');
}

function profileDir(alias: string): string {
  return path.join(sc4sapHomeDir(), 'profiles', alias);
}

function legacyEnvFile(cwd: string): string {
  return path.join(cwd, '.sc4sap', 'sap.env');
}

function readAlias(cwd: string): string | undefined {
  const pointer = activeProfileFile(cwd);
  if (!fs.existsSync(pointer)) return undefined;
  const raw = fs.readFileSync(pointer, 'utf8').trim();
  return raw.length > 0 ? raw : undefined;
}

function normalizeTier(value: string | undefined): Tier {
  const v = (value || '').trim().toUpperCase();
  if (v === 'DEV' || v === 'QA' || v === 'PRD') return v;
  // Legacy compatibility: unknown/missing → DEV (permissive).
  return 'DEV';
}

/**
 * Load the active profile (or legacy sap.env) without mutating process.env.
 * Throws if an alias is pointed to but the profile folder does not exist.
 */
export function loadActiveProfile(cwd: string = process.cwd()): LoadedProfile {
  const alias = readAlias(cwd);

  let sourcePath: string;
  let legacy: boolean;

  if (alias) {
    sourcePath = path.join(profileDir(alias), 'sap.env');
    legacy = false;
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `Active profile "${alias}" points to a missing env file: ${sourcePath}`,
      );
    }
  } else {
    sourcePath = legacyEnvFile(cwd);
    legacy = true;
    if (!fs.existsSync(sourcePath)) {
      // No profile and no legacy env — return an empty shell so the server
      // can still boot in inspection-only mode.
      return {
        alias: undefined,
        sourcePath,
        envVars: {},
        tier: 'DEV',
        readonly: false,
        legacy: true,
      };
    }
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = dotenv.parse(raw);
  const resolved: Record<string, string> = { ...parsed };

  // Resolve keychain:<service>/<account> references for SAP_PASSWORD.
  const pwd = resolved.SAP_PASSWORD;
  if (pwd) {
    resolved.SAP_PASSWORD = resolveSecret(pwd);
  }

  const tier = normalizeTier(resolved.SAP_TIER);

  return {
    alias,
    sourcePath,
    envVars: resolved,
    tier,
    readonly: tier !== 'DEV',
    legacy,
  };
}

/**
 * Overwrite process.env.SAP_* with the loaded profile's values and cache the
 * tier for the readonly guard. Callers must invoke this before any consumer
 * reads process.env (i.e. before connection factories, config managers).
 */
export function applyProfile(loaded: LoadedProfile): void {
  for (const key of SAP_ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
  for (const [k, v] of Object.entries(loaded.envVars)) {
    process.env[k] = v;
  }
  activeTier = loaded.tier;
  activeAlias = loaded.alias;
}

/** Returns the currently-active tier (defaults to 'DEV' before any load). */
export function getActiveTier(): Tier {
  return activeTier;
}

/** Returns the currently-active alias, or undefined in legacy mode. */
export function getActiveAlias(): string | undefined {
  return activeAlias;
}

/** Returns true iff the active profile is read-only (QA or PRD). */
export function isReadOnlyTier(): boolean {
  return activeTier !== 'DEV';
}

/**
 * Load the active profile and apply it to process.env in one step. Idempotent:
 * safe to call multiple times. Used at server startup and by ReloadProfile.
 */
export function activateProfile(cwd: string = process.cwd()): LoadedProfile {
  const loaded = loadActiveProfile(cwd);
  applyProfile(loaded);
  return loaded;
}

/** Test-only reset of the cached tier/alias. */
export function __resetProfileState(): void {
  activeTier = 'DEV';
  activeAlias = undefined;
}
