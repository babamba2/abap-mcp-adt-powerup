"use strict";
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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const dotenv = __importStar(require("dotenv"));
const index_js_1 = require("../lib/auth/index.js");
const index_js_2 = require("../lib/config/index.js");
const index_js_3 = require("../lib/handlers/groups/index.js");
const CompositeHandlersRegistry_js_1 = require("../lib/handlers/registry/CompositeHandlersRegistry.js");
const profile_js_1 = require("../lib/profile.js");
const utils_js_1 = require("../lib/utils.js");
const AuthBrokerConfig_js_1 = require("./AuthBrokerConfig.js");
const SseServer_js_1 = require("./SseServer.js");
const StdioServer_js_1 = require("./StdioServer.js");
const StreamableHttpServer_js_1 = require("./StreamableHttpServer.js");
const stderrLogger = {
    info: (...args) => console.error(...args),
    warn: (...args) => console.error(...args),
    error: (...args) => console.error(...args),
    debug: (...args) => console.error(...args),
};
const silentLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
};
const loggerForTransport = process.env.DEBUG_AUTH_LOG === 'true' ? stderrLogger : silentLogger;
// Keep strong reference to running server instance to avoid premature GC/exit
let activeServer;
function hasArg(name) {
    return process.argv.includes(name);
}
/**
 * In v2 flow, .env can be loaded into auth-broker session storage without
 * populating process.env. System context resolver relies on process.env
 * for SAP_MASTER_SYSTEM / SAP_RESPONSIBLE, so bridge these values here.
 */
function hydrateSystemContextFromEnvFile(envFilePath) {
    if (!envFilePath || !fs.existsSync(envFilePath)) {
        return;
    }
    try {
        const parsed = dotenv.parse(fs.readFileSync(envFilePath, 'utf8'));
        const keys = [
            'SAP_MASTER_SYSTEM',
            'SAP_RESPONSIBLE',
            'SAP_USERNAME',
            'SAP_CLIENT',
            'SAP_CONNECTION_TYPE',
            'SAP_SYSTEM_TYPE',
        ];
        for (const key of keys) {
            const value = parsed[key];
            if (!process.env[key] && value) {
                process.env[key] = value;
            }
        }
    }
    catch {
        // Ignore .env parse errors here; auth-broker initialization handles config validation.
    }
}
function showVersion() {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(packageJson.version);
    process.exit(0);
}
/**
 * Additional help sections specific to v2 server
 */
const V2_HELP_SECTIONS = `
ENVIRONMENT VARIABLES:

  MCP Server Configuration:
    MCP_TRANSPORT                  Transport type: stdio|http|sse (default: stdio)
    MCP_HTTP_HOST                  HTTP server host (default: 127.0.0.1)
    MCP_HTTP_PORT                  HTTP server port (default: 3000)
    MCP_SSE_HOST                   SSE server host (default: 127.0.0.1)
    MCP_SSE_PORT                   SSE server port (default: 3001)
    MCP_ENV_PATH                   Explicit .env file path (same as --env-path)
    MCP_UNSAFE                     Disable connection validation (true|false)
    MCP_USE_AUTH_BROKER            Force auth-broker usage (true|false)
    MCP_BROWSER                    Browser for OAuth2 flow (e.g., chrome, firefox)

  Auth-Broker:
    DEBUG_AUTH_LOG                 Enable debug logging for auth-broker (true|false)
    DEBUG_AUTH_BROKER              Alias for DEBUG_AUTH_LOG
    AUTH_BROKER_PATH               Custom paths for service keys and sessions
                                   Unix: colon-separated (e.g., /path1:/path2)
                                   Windows: semicolon-separated (e.g., C:\\\\path1;C:\\\\path2)

  Debug Options:
    DEBUG_HANDLERS                 Enable handler debug logging (true|false)
    DEBUG_CONNECTORS               Enable connector debug logging (true|false)
    DEBUG_CONNECTION_MANAGER       Enable connection manager debug logging (true|false)
    HANDLER_LOG_SILENT             Disable all handler logs (true|false)

SAP CONNECTION (.env file):

  Basic Authentication (on-premise):
    SAP_URL                        SAP system URL (required)
    SAP_CLIENT                     SAP client number (required for basic auth)
    SAP_AUTH_TYPE                  Authentication type: basic|jwt (default: basic)
    SAP_CONNECTION_TYPE            Connection type: http|rfc (default: http)
    SAP_SYSTEM_TYPE                SAP system type: cloud (default) | onprem | legacy
                                   Controls tool availability (e.g. Programs need onprem)
                                   Set to 'onprem' for on-premise systems
    SAP_USERNAME                   SAP username (required for basic auth)
    SAP_PASSWORD                   SAP password (required for basic auth)
    SAP_LANGUAGE                   SAP language (optional, e.g., EN, DE)

  JWT/OAuth2 Authentication:
    SAP_JWT_TOKEN                  JWT token (required for jwt auth)
    SAP_REFRESH_TOKEN              Refresh token for token renewal
    SAP_UAA_URL                    UAA URL for OAuth2 (or UAA_URL)
    SAP_UAA_CLIENT_ID              UAA Client ID (or UAA_CLIENT_ID)
    SAP_UAA_CLIENT_SECRET          UAA Client Secret (or UAA_CLIENT_SECRET)

  RFC Connection (legacy systems, BASIS < 7.50):
    SAP_CONNECTION_TYPE=rfc        Enables RFC transport via SADT_REST_RFC_ENDPOINT
    SAP_URL                        SAP system URL (host:port used to derive RFC params)
    SAP_USERNAME                   SAP username
    SAP_PASSWORD                   SAP password
    SAP_CLIENT                     SAP client number
    Requires: SAP NW RFC SDK + node-rfc package installed

  System Context (on-premise):
    SAP_MASTER_SYSTEM              SAP system ID (e.g., DEV, QAS). Required for on-prem
                                   create/update — ensures correct transport request binding.
                                   Cloud systems resolve this automatically via API.
    SAP_RESPONSIBLE                Responsible user (optional, falls back to SAP_USERNAME)

  HTTP/SSE Headers (System Context):
    x-sap-master-system              Per-request SAP system ID (overrides SAP_MASTER_SYSTEM)
    x-sap-responsible                Per-request responsible user (overrides SAP_RESPONSIBLE)

GENERATING .ENV FROM SERVICE KEY:
  Install connection package: npm install -g @babamba2/mcp-abap-connection
  Generate .env: sap-abap-auth auth -k path/to/service-key.json
`;
function showHelp() {
    console.error(index_js_2.ServerConfigManager.generateHelp(V2_HELP_SECTIONS));
}
async function main() {
    // Check for --version first
    if (hasArg('--version') || hasArg('-v')) {
        showVersion();
    }
    // Check for --help
    if (hasArg('--help') || hasArg('-h')) {
        showHelp();
        process.exit(0);
    }
    // Activate sc4sap multi-profile BEFORE config/broker loads so
    // process.env.SAP_* reflects the selected profile. Safe no-op when no
    // active-profile.txt / legacy sap.env is present.
    try {
        const loaded = (0, profile_js_1.activateProfile)();
        if (loaded.alias) {
            console.error(`[MCP] Active sc4sap profile: ${loaded.alias} (tier=${loaded.tier}, readonly=${loaded.readonly})`);
        }
    }
    catch (err) {
        console.error(`[MCP] Warning: sc4sap profile activation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Use ServerConfigManager for all config parsing
    const configManager = new index_js_2.ServerConfigManager();
    const config = await configManager.getConfig();
    hydrateSystemContextFromEnvFile(config.envFile);
    // CLI --connection-type overrides env var
    if (config.connectionType && !process.env.SAP_CONNECTION_TYPE) {
        process.env.SAP_CONNECTION_TYPE = config.connectionType;
    }
    const baseContext = {
        connection: undefined,
        logger: undefined,
    };
    // Build handlers based on exposition config (default to readonly,high)
    const exposition = config.exposition || ['readonly', 'high'];
    const handlerGroups = [];
    if (exposition.includes('readonly')) {
        handlerGroups.push(new index_js_3.ReadOnlyHandlersGroup(baseContext));
        handlerGroups.push(new index_js_3.SystemHandlersGroup(baseContext));
    }
    if (exposition.includes('high')) {
        handlerGroups.push(new index_js_3.HighLevelHandlersGroup(baseContext));
    }
    if (exposition.includes('compact')) {
        handlerGroups.push(new index_js_3.CompactHandlersGroup(baseContext));
    }
    if (exposition.includes('low')) {
        handlerGroups.push(new index_js_3.LowLevelHandlersGroup(baseContext));
    }
    // SearchHandlersGroup is always included
    handlerGroups.push(new index_js_3.SearchHandlersGroup(baseContext));
    const handlersRegistry = new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry(handlerGroups);
    // Create auth broker config using adapter
    const brokerConfig = AuthBrokerConfig_js_1.AuthBrokerConfig.fromServerConfig(config, loggerForTransport);
    const authBrokerFactory = new index_js_1.AuthBrokerFactory(brokerConfig);
    // Initialize default broker (important for .env file support)
    await authBrokerFactory.initializeDefaultBroker();
    // Display auth configuration at startup (always show for transparency)
    const defaultBroker = authBrokerFactory.getDefaultBroker();
    if (defaultBroker) {
        try {
            // Get connection config from broker to display
            const connConfig = await defaultBroker.getConnectionConfig(config.mcpDestination || 'default');
            if (connConfig) {
                const displayConfig = {
                    serviceUrl: connConfig.serviceUrl,
                    sapClient: connConfig.sapClient,
                    authType: connConfig.authType,
                    username: connConfig.username,
                    password: connConfig.password,
                    jwtToken: connConfig.authorizationToken,
                };
                // Try to get auth config for UAA details
                try {
                    const authConfig = await defaultBroker.sessionStore?.getAuthorizationConfig?.(config.mcpDestination || 'default');
                    if (authConfig) {
                        displayConfig.uaaUrl = authConfig.uaaUrl;
                        displayConfig.uaaClientId = authConfig.uaaClientId;
                        displayConfig.uaaClientSecret = authConfig.uaaClientSecret;
                        displayConfig.refreshToken = authConfig.refreshToken;
                    }
                }
                catch {
                    // Ignore - auth config is optional
                }
                // Determine source
                let source = 'unknown';
                if (config.mcpDestination) {
                    source = `service-key: ${config.mcpDestination}`;
                }
                else if (config.envFile) {
                    source = config.envFile;
                }
                console.error((0, utils_js_1.formatAuthConfigForDisplay)(displayConfig, source));
            }
        }
        catch (error) {
            // Don't fail startup if we can't display config
            console.error(`[MCP] Warning: Could not display auth config: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    else if (config.envFile || config.mcpDestination) {
        // Broker not created but config was expected
        console.error(`[MCP] Warning: Auth broker not initialized. Config source: ${config.envFile || config.mcpDestination}`);
    }
    if (config.transport === 'stdio') {
        // For .env file, use 'default' broker; for --mcp, use specified destination
        const configuredBrokerKey = config.mcpDestination ?? (config.envFile ? 'default' : undefined);
        const configuredBroker = configuredBrokerKey
            ? await authBrokerFactory.getOrCreateAuthBroker(configuredBrokerKey)
            : undefined;
        let broker;
        let brokerKey;
        if (configuredBroker) {
            broker = configuredBroker;
            brokerKey = configuredBrokerKey;
        }
        else {
            // Inspection-only mode: no connection parameters provided
            const { MockAbapConnection } = await import('./MockAbapConnection.js');
            const mockConnection = new MockAbapConnection();
            broker = {
                getSession: async () => ({
                    connection: mockConnection,
                    client: {},
                    config: { url: 'http://mock', authType: 'basic' },
                    getHeaders: () => ({}),
                }),
                getConnectionConfig: async () => ({
                    serviceUrl: 'http://mock',
                    authType: 'basic',
                    username: 'mock',
                    password: 'mock',
                }),
                getToken: async () => undefined,
            };
            brokerKey = 'mock';
            console.error('[MCP] Starting in inspection-only mode (no connection parameters).');
            console.error('[MCP] To connect to SAP system, use --mcp=<destination> or --env-path=<path>');
        }
        const server = new StdioServer_js_1.StdioServer(handlersRegistry, broker, {
            logger: loggerForTransport,
        });
        activeServer = server;
        await server.start(brokerKey);
        return;
    }
    if (config.transport === 'sse') {
        const server = new SseServer_js_1.SseServer(handlersRegistry, authBrokerFactory, {
            host: config.host,
            port: config.port,
            ssePath: config.ssePath,
            postPath: config.postPath,
            defaultDestination: config.mcpDestination ?? (config.envFile ? 'default' : undefined),
            logger: loggerForTransport,
        });
        activeServer = server;
        await server.start();
        return;
    }
    // http
    const server = new StreamableHttpServer_js_1.StreamableHttpServer(handlersRegistry, authBrokerFactory, {
        host: config.host,
        port: config.port,
        enableJsonResponse: config.httpJsonResponse,
        path: config.httpPath,
        defaultDestination: config.mcpDestination ?? (config.envFile ? 'default' : undefined),
        logger: loggerForTransport,
    });
    activeServer = server;
    await server.start();
}
void main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[MCP] launcher failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=launcher.js.map