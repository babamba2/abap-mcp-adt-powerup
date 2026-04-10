"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEnvArg = parseEnvArg;
exports.parseAuthBrokerPathArg = parseAuthBrokerPathArg;
exports.parseMcpDestinationArg = parseMcpDestinationArg;
exports.parseBrowserArg = parseBrowserArg;
exports.getTransportType = getTransportType;
exports.resolveEnvFromCwd = resolveEnvFromCwd;
exports.buildRuntimeConfig = buildRuntimeConfig;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const envResolver_1 = require("./envResolver");
function parseEnvArg() {
    const args = process.argv;
    let envDestination;
    let envPath;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--env-path=')) {
            const value = arg.slice('--env-path='.length);
            if (value.length === 0)
                continue;
            envPath = value;
        }
        else if (arg === '--env-path' && i + 1 < args.length) {
            const value = args[i + 1];
            if (!value || value.startsWith('-'))
                continue;
            envPath = value;
        }
        else if (arg.startsWith('--env=')) {
            const value = arg.slice('--env='.length);
            if (value.length === 0)
                continue;
            envDestination = value;
        }
        else if (arg === '--env' && i + 1 < args.length) {
            const value = args[i + 1];
            if (!value || value.startsWith('-'))
                continue;
            envDestination = value;
        }
    }
    return (0, envResolver_1.resolveEnvFilePath)({
        envDestination,
        envPath: envPath || process.env.MCP_ENV_PATH,
        authBrokerPath: parseAuthBrokerPathArg(),
    });
}
function parseAuthBrokerPathArg() {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--auth-broker-path=')) {
            return arg.slice('--auth-broker-path='.length);
        }
        else if (arg === '--auth-broker-path' && i + 1 < args.length) {
            return args[i + 1];
        }
    }
    return undefined;
}
function parseMcpDestinationArg() {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--mcp=')) {
            return arg.slice('--mcp='.length);
        }
        else if (arg === '--mcp' && i + 1 < args.length) {
            return args[i + 1];
        }
    }
    return undefined;
}
function parseBrowserArg() {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--browser=')) {
            return arg.slice('--browser='.length);
        }
        else if (arg === '--browser' && i + 1 < args.length) {
            return args[i + 1];
        }
    }
    // Also check environment variable
    return process.env.MCP_BROWSER;
}
function getTransportType() {
    // First check command line arguments
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        // Check for --transport=value format
        if (arg.startsWith('--transport=')) {
            return arg.slice('--transport='.length);
        }
        // Check for --transport value format
        if (arg === '--transport' && i + 1 < args.length) {
            return args[i + 1];
        }
    }
    // Then check environment variable
    if (process.env.MCP_TRANSPORT) {
        return process.env.MCP_TRANSPORT;
    }
    // Auto-detect stdio mode when stdin is not a TTY (e.g., when run by inspector)
    // Only if no explicit transport was set via argv or env
    if (!process.stdin.isTTY) {
        return 'stdio';
    }
    return null;
}
function resolveEnvFromCwd() {
    const cwdEnvPath = node_path_1.default.resolve(process.cwd(), '.env');
    return node_fs_1.default.existsSync(cwdEnvPath) ? cwdEnvPath : undefined;
}
function buildRuntimeConfig() {
    const useAuthBroker = process.argv.includes('--auth-broker') ||
        process.env.MCP_USE_AUTH_BROKER === 'true';
    const isTestEnv = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    const authBrokerPath = parseAuthBrokerPathArg();
    const defaultMcpDestination = parseMcpDestinationArg();
    const browser = parseBrowserArg();
    const unsafe = process.argv.includes('--unsafe') || process.env.MCP_UNSAFE === 'true';
    const explicitTransportType = getTransportType();
    // Check if transport was explicitly set (not auto-detected)
    const hasExplicitTransportArg = process.argv.some((arg, i) => arg.startsWith('--transport=') ||
        (arg === '--transport' && i + 1 < process.argv.length));
    // If transport was auto-detected (not explicitly set), consider it as explicit for stdio mode
    // This allows stdio mode to work when run by inspector without --transport=stdio argument
    const isAutoDetectedStdio = explicitTransportType === 'stdio' &&
        !hasExplicitTransportArg &&
        !process.env.MCP_TRANSPORT;
    // Default transport is stdio (for MCP clients like Cline, Cursor, Claude Desktop)
    // Auto-detects stdio when stdin is not TTY (e.g., piped or run by MCP client)
    // For HTTP/SSE, explicitly use --transport=http or --transport=sse
    const transportType = explicitTransportType || 'stdio';
    const isHttp = transportType === 'http' ||
        transportType === 'streamable-http' ||
        transportType === 'server';
    const isSse = transportType === 'sse';
    const isStdio = transportType === 'stdio';
    // For auto-detected stdio, treat it as explicit for env mandatory check
    const effectiveExplicitTransportType = isAutoDetectedStdio
        ? 'stdio'
        : explicitTransportType;
    const isEnvMandatory = effectiveExplicitTransportType !== null &&
        (isStdio || isSse) &&
        !defaultMcpDestination &&
        !useAuthBroker &&
        !isTestEnv;
    const envFilePath = parseEnvArg() ?? process.env.MCP_ENV_PATH;
    return {
        useAuthBroker,
        isTestEnv,
        authBrokerPath,
        defaultMcpDestination,
        browser,
        unsafe,
        explicitTransportType: effectiveExplicitTransportType,
        transportType,
        isHttp,
        isSse,
        isStdio,
        isEnvMandatory,
        envFilePath,
    };
}
//# sourceMappingURL=runtimeConfig.js.map