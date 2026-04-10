"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamableHttpServer = void 0;
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const handlerLogger_js_1 = require("../lib/handlerLogger.js");
const BaseMcpServer_js_1 = require("./BaseMcpServer.js");
const DEFAULT_VERSION = process.env.npm_package_version ?? '1.0.0';
/**
 * Minimal Streamable HTTP server implementation.
 * Creates new transport for each HTTP POST and forwards request to the MCP server.
 * Destination is taken from x-mcp-destination header or defaultDestination.
 *
 * Supports two modes:
 * 1. Standalone mode: Creates its own Express server (when no app option provided)
 * 2. Embedded mode: Registers routes on external app (when app option provided)
 */
class StreamableHttpServer extends BaseMcpServer_js_1.BaseMcpServer {
    handlersRegistry;
    authBrokerFactory;
    host;
    port;
    enableJsonResponse;
    defaultDestination;
    path;
    externalApp;
    version;
    standaloneServer;
    constructor(handlersRegistry, authBrokerFactory, opts) {
        super({
            name: 'mcp-abap-adt',
            version: opts?.version ?? DEFAULT_VERSION,
            logger: opts?.logger ?? handlerLogger_js_1.noopLogger,
        });
        this.handlersRegistry = handlersRegistry;
        this.authBrokerFactory = authBrokerFactory;
        this.version = opts?.version ?? DEFAULT_VERSION;
        this.host = opts?.host ?? '127.0.0.1';
        this.port = opts?.port ?? 3000;
        this.enableJsonResponse = opts?.enableJsonResponse ?? true;
        this.defaultDestination = opts?.defaultDestination;
        this.path = opts?.path ?? '/mcp/stream/http';
        this.externalApp = opts?.app;
        // Register handlers once for shared MCP server
        this.registerHandlers(this.handlersRegistry);
    }
    /**
     * Creates the request handler function
     * Can be used to register on external app or internal Express
     */
    createRequestHandler() {
        return async (req, res) => {
            const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
            const mcpMethod = req.body?.method;
            const mcpId = req.body?.id;
            const toolName = mcpMethod === 'tools/call'
                ? req.body?.params?.name
                : undefined;
            const methodInfo = toolName
                ? `${mcpMethod} -> ${toolName}`
                : (mcpMethod ?? 'unknown');
            const isPing = mcpMethod === 'ping';
            if (!isPing) {
                console.error(`[StreamableHttpServer] ${req.method} ${req.path} from ${clientId} | ${methodInfo} (id=${mcpId ?? '-'})`);
            }
            try {
                const server = this.createPerRequestServer();
                let destination;
                let broker;
                // Priority 1: Check x-mcp-destination header
                const destinationHeader = req.headers['x-mcp-destination'] ??
                    req.headers['X-MCP-Destination'];
                if (destinationHeader) {
                    destination = destinationHeader;
                    broker =
                        await this.authBrokerFactory.getOrCreateAuthBroker(destination);
                }
                // Priority 2: Check SAP connection headers (x-sap-url + auth params)
                // Headers will be passed directly to handlers, no broker needed
                else if (this.hasSapConnectionHeaders(req.headers)) {
                    // No destination, no broker - create connection directly from headers
                    destination = undefined;
                    broker = undefined;
                    server.setConnectionContextFromHeadersPublic(req.headers);
                }
                // Priority 3: Use default destination
                else if (this.defaultDestination) {
                    destination = this.defaultDestination;
                    // Initialize broker for the selected default destination
                    broker =
                        await this.authBrokerFactory.getOrCreateAuthBroker(destination);
                }
                // Priority 4: No auth params at all -> reject request
                else {
                    res
                        .status(400)
                        .send('Missing SAP connection context. Provide x-mcp-destination header, configure default destination (--mcp/--env-path), or pass x-sap-* headers.');
                    return;
                }
                if (destination && !broker) {
                    throw new Error(`Auth broker not initialized for destination: ${destination}`);
                }
                if (destination && broker) {
                    await server.setConnectionContextPublic(destination, broker);
                }
                const authSource = destination
                    ? `destination=${destination}`
                    : this.hasSapConnectionHeaders(req.headers)
                        ? 'x-sap-* headers'
                        : 'none';
                if (!isPing) {
                    console.error(`[StreamableHttpServer] ${methodInfo} | auth: ${authSource}`);
                }
                const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined, // stateless mode to avoid ID collisions
                    enableJsonResponse: this.enableJsonResponse,
                });
                res.on('close', () => {
                    void transport.close();
                });
                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
                if (!isPing) {
                    console.error(`[StreamableHttpServer] ${methodInfo} (id=${mcpId ?? '-'}) completed`);
                }
            }
            catch (err) {
                console.error(`[StreamableHttpServer] ${methodInfo} (id=${mcpId ?? '-'}) FAILED:`, err);
                if (!res.headersSent) {
                    res.status(500).send('Internal Server Error');
                }
            }
        };
    }
    /**
     * Register routes on an external HTTP application
     * Use this when integrating with existing Express/CDS/CAP server
     *
     * @param app - External HTTP application (Express, CDS, etc.)
     * @param options - Route registration options
     */
    registerRoutes(app, _options) {
        const handler = this.createRequestHandler();
        // Health check endpoint — lightweight, no MCP protocol logic
        app.get('/mcp/health', (_req, res) => {
            res.json({
                status: 'ok',
                uptime: Math.floor(process.uptime()),
                version: this.version,
                transport: 'http',
            });
        });
        // Only handle POST requests - GET SSE streams cause abort errors on disconnect
        app.post(this.path, handler);
        // Return 405 for other methods to avoid SSE stream issues
        app.all(this.path, (_req, res) => {
            res.status(405).send('Method Not Allowed');
        });
        console.error(`[StreamableHttpServer] Routes registered on external app at ${this.path}`);
        console.error(`[StreamableHttpServer] JSON response mode: ${this.enableJsonResponse}`);
        if (this.defaultDestination) {
            console.error(`[StreamableHttpServer] Default destination: ${this.defaultDestination}`);
        }
    }
    /**
     * Get the configured endpoint path
     */
    getPath() {
        return this.path;
    }
    /**
     * Start the server
     *
     * In standalone mode (no external app): Creates Express server and starts listening
     * In embedded mode (external app provided): Only registers routes on external app
     */
    async start() {
        // If external app was provided in constructor, register routes on it
        if (this.externalApp) {
            this.registerRoutes(this.externalApp);
            return;
        }
        // Standalone mode: create own Express server
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        this.registerRoutes(app);
        await new Promise((resolve, reject) => {
            const server = app.listen(this.port, this.host);
            this.standaloneServer = server;
            server.once('listening', () => {
                console.error(`[StreamableHttpServer] Server started on ${this.host}:${this.port}`);
                console.error(`[StreamableHttpServer] Endpoint: http://${this.host}:${this.port}${this.path}`);
                resolve();
            });
            server.once('error', reject);
        });
    }
    /**
     * Check if request has SAP connection headers
     */
    hasSapConnectionHeaders(headers) {
        const hasUrl = headers['x-sap-url'] || headers['X-SAP-URL'];
        const hasJwtAuth = headers['x-sap-jwt-token'] || headers['X-SAP-JWT-Token'];
        const hasBasicAuth = (headers['x-sap-login'] || headers['X-SAP-Login']) &&
            (headers['x-sap-password'] || headers['X-SAP-Password']);
        return !!(hasUrl && (hasJwtAuth || hasBasicAuth));
    }
    createPerRequestServer() {
        class PerRequestServer extends BaseMcpServer_js_1.BaseMcpServer {
            registry;
            constructor(registry, version, logger) {
                super({ name: 'mcp-abap-adt', version, logger });
                this.registry = registry;
                this.registerHandlers(this.registry);
            }
            setConnectionContextPublic(destination, broker) {
                if (!broker) {
                    return Promise.resolve();
                }
                return this.setConnectionContext(destination, broker);
            }
            setConnectionContextFromHeadersPublic(headers) {
                this.setConnectionContextFromHeaders(headers);
            }
        }
        return new PerRequestServer(this.handlersRegistry, this.version, this.logger);
    }
}
exports.StreamableHttpServer = StreamableHttpServer;
//# sourceMappingURL=StreamableHttpServer.js.map