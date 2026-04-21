"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadActiveProfile = loadActiveProfile;
exports.applyProfile = applyProfile;
exports.getActiveTier = getActiveTier;
exports.getActiveAlias = getActiveAlias;
exports.isReadOnlyTier = isReadOnlyTier;
exports.activateProfile = activateProfile;
exports.__resetProfileState = __resetProfileState;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const dotenv = __importStar(require("dotenv"));
const secrets_1 = require("./secrets");
/** Module-level cache of the currently-active tier, read by the guard. */
let activeTier = 'DEV';
let activeAlias;
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
function sc4sapHomeDir() {
    // Optional override for tests and custom installs. Value is the .sc4sap
    // directory itself (not the parent home), so `~/.sc4sap` becomes
    // `$SC4SAP_HOME_DIR`.
    const override = process.env.SC4SAP_HOME_DIR;
    if (override)
        return override;
    return path.join(os.homedir(), '.sc4sap');
}
function activeProfileFile(cwd) {
    return path.join(cwd, '.sc4sap', 'active-profile.txt');
}
function profileDir(alias) {
    return path.join(sc4sapHomeDir(), 'profiles', alias);
}
function legacyEnvFile(cwd) {
    return path.join(cwd, '.sc4sap', 'sap.env');
}
function readAlias(cwd) {
    const pointer = activeProfileFile(cwd);
    if (!fs.existsSync(pointer))
        return undefined;
    const raw = fs.readFileSync(pointer, 'utf8').trim();
    return raw.length > 0 ? raw : undefined;
}
function normalizeTier(value) {
    const v = (value || '').trim().toUpperCase();
    if (v === 'DEV' || v === 'QA' || v === 'PRD')
        return v;
    // Legacy compatibility: unknown/missing → DEV (permissive).
    return 'DEV';
}
/**
 * Load the active profile (or legacy sap.env) without mutating process.env.
 * Throws if an alias is pointed to but the profile folder does not exist.
 */
function loadActiveProfile(cwd = process.cwd()) {
    const alias = readAlias(cwd);
    let sourcePath;
    let legacy;
    if (alias) {
        sourcePath = path.join(profileDir(alias), 'sap.env');
        legacy = false;
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Active profile "${alias}" points to a missing env file: ${sourcePath}`);
        }
    }
    else {
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
    const resolved = { ...parsed };
    // Resolve keychain:<service>/<account> references for SAP_PASSWORD.
    const pwd = resolved.SAP_PASSWORD;
    if (pwd) {
        resolved.SAP_PASSWORD = (0, secrets_1.resolveSecret)(pwd);
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
function applyProfile(loaded) {
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
function getActiveTier() {
    return activeTier;
}
/** Returns the currently-active alias, or undefined in legacy mode. */
function getActiveAlias() {
    return activeAlias;
}
/** Returns true iff the active profile is read-only (QA or PRD). */
function isReadOnlyTier() {
    return activeTier !== 'DEV';
}
/**
 * Load the active profile and apply it to process.env in one step. Idempotent:
 * safe to call multiple times. Used at server startup and by ReloadProfile.
 */
function activateProfile(cwd = process.cwd()) {
    const loaded = loadActiveProfile(cwd);
    applyProfile(loaded);
    return loaded;
}
/** Test-only reset of the cached tier/alias. */
function __resetProfileState() {
    activeTier = 'DEV';
    activeAlias = undefined;
}
//# sourceMappingURL=profile.js.map