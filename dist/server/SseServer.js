"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseServer = void 0;
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const express_1 = __importDefault(require("express"));
const handlerLogger_js_1 = require("../lib/handlerLogger.js");
const BaseMcpServer_js_1 = require("./BaseMcpServer.js");
const DEFAULT_VERSION = process.env.npm_package_version ?? '1.0.0';
/**
 * Minimal SSE server: creates a new BaseMcpServer per GET connection, routes POST by sessionId.
 *
 * Supports two modes:
 * 1. Standalone mode: Creates its own Express server (when no app option provided)
 * 2. Embedded mode: Registers routes on external app (when app option provided)
 */
class SseServer {
    handlersRegistry;
    authBrokerFactory;
    host;
    port;
    ssePath;
    postPath;
    defaultDestination;
    sessions = new Map();
    logger;
    version;
    externalApp;
    standaloneServer;
    constructor(handlersRegistry, authBrokerFactory, opts) {
        this.handlersRegistry = handlersRegistry;
        this.authBrokerFactory = authBrokerFactory;
        this.host = opts?.host ?? '127.0.0.1';
        this.port = opts?.port ?? 3001;
        this.ssePath = opts?.ssePath ?? '/sse';
        this.postPath = opts?.postPath ?? '/messages';
        this.defaultDestination = opts?.defaultDestination;
        this.logger = opts?.logger ?? handlerLogger_js_1.noopLogger;
        this.version = opts?.version ?? DEFAULT_VERSION;
        this.externalApp = opts?.app;
    }
    /**
     * Register routes on an external HTTP application
     * Use this when integrating with existing Express/CDS/CAP server
     *
     * @param app - External HTTP application (Express, CDS, etc.)
     * @param options - Route registration options
     */
    registerRoutes(app, _options) {
        // Health check endpoint — lightweight, no MCP protocol logic
        app.get('/mcp/health', ((_req, res) => {
            res.json({
                status: 'ok',
                uptime: Math.floor(process.uptime()),
                version: this.version,
                transport: 'sse',
                activeSessions: this.sessions.size,
            });
        }));
        app.get(this.ssePath, (async (req, res) => {
            await this.handleGet(req, res);
        }));
        app.post(this.postPath, (async (req, res) => {
            const url = new URL(req.originalUrl, `http://${req.headers.host}`);
            await this.handlePost(req, res, url);
        }));
        console.error(`[SseServer] Routes registered on external app`);
        console.error(`[SseServer] SSE endpoint: ${this.ssePath}`);
        console.error(`[SseServer] POST endpoint: ${this.postPath}`);
        if (this.defaultDestination) {
            console.error(`[SseServer] Default destination: ${this.defaultDestination}`);
        }
    }
    /**
     * Get the configured SSE endpoint path
     */
    getSsePath() {
        return this.ssePath;
    }
    /**
     * Get the configured POST endpoint path
     */
    getPostPath() {
        return this.postPath;
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
                console.error(`[SseServer] Server started on ${this.host}:${this.port}`);
                console.error(`[SseServer] SSE endpoint: http://${this.host}:${this.port}${this.ssePath}`);
                console.error(`[SseServer] POST endpoint: http://${this.host}:${this.port}${this.postPath}`);
                resolve();
            });
            server.once('error', reject);
        });
    }
    async handleGet(req, res) {
        let destination;
        let broker;
        // Priority 1: Check x-mcp-destination header
        const destinationHeader = req.headers['x-mcp-destination'] ??
            req.headers['X-MCP-Destination'];
        if (destinationHeader) {
            destination = destinationHeader;
            broker = await this.authBrokerFactory.getOrCreateAuthBroker(destination);
        }
        // Priority 2: Check SAP connection headers (x-sap-url + auth params)
        // Headers will be passed directly to handlers, no broker needed
        else if (this.hasSapConnectionHeaders(req.headers)) {
            // No destination, no broker - handlers will use headers directly
            destination = undefined;
            broker = undefined;
        }
        // Priority 3: Use default destination
        else if (this.defaultDestination) {
            destination = this.defaultDestination;
            broker = await this.authBrokerFactory.getOrCreateAuthBroker(destination);
        }
        // Priority 4: No auth params at all -> reject request
        else {
            res
                .status(400)
                .send('Missing SAP connection context. Provide x-mcp-destination header, configure default destination (--mcp/--env-path), or pass x-sap-* headers.');
            return;
        }
        this.logger.debug(`SSE GET: destination=${destination ?? 'none'}`);
        class SessionServer extends BaseMcpServer_js_1.BaseMcpServer {
            registry;
            loggerImpl;
            ver;
            constructor(registry, loggerImpl, ver) {
                super({ name: 'mcp-abap-adt-sse', version: ver, logger: loggerImpl });
                this.registry = registry;
                this.loggerImpl = loggerImpl;
                this.ver = ver;
            }
            async init(dest, b, hdrs) {
                if (dest && b) {
                    await this.setConnectionContext(dest, b);
                }
                else if (hdrs) {
                    this.setConnectionContextFromHeaders(hdrs);
                }
                this.registerHandlers(this.registry);
            }
        }
        const server = new SessionServer(this.handlersRegistry, this.logger, this.version);
        await server.init(destination, broker, this.hasSapConnectionHeaders(req.headers) ? req.headers : undefined);
        const transport = new sse_js_1.SSEServerTransport(this.postPath, res);
        const sessionId = transport.sessionId;
        console.error(`[SSE GET] Created session ${sessionId} for destination ${destination}`);
        this.sessions.set(sessionId, { server, transport });
        console.error(`[SSE GET] Session stored, total sessions: ${this.sessions.size}`);
        // Connect transport to server BEFORE registering close handler
        // This ensures connection is established before any cleanup can happen
        try {
            await server.connect(transport);
            this.logger.debug(`SSE GET: server connected for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`SSE GET: failed to connect for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
            this.sessions.delete(sessionId);
            if (!res.headersSent) {
                res.writeHead(500).end('Internal Server Error');
            }
            return;
        }
        // Register cleanup handler AFTER successful connection
        res.on('close', () => {
            console.error(`[SSE CLOSE] Connection closed for session ${sessionId}`);
            this.sessions.delete(sessionId);
            void transport.close();
            void server.close();
        });
    }
    async handlePost(req, res, url) {
        const sessionId = (url?.searchParams.get('sessionId') ||
            req.headers['x-session-id'] ||
            '');
        const mcpMethod = req.body?.method;
        const isPing = mcpMethod === 'ping';
        if (!isPing) {
            console.error(`[SSE POST] sessionId=${sessionId}, activeSessions=${this.sessions.size}, keys=[${Array.from(this.sessions.keys()).join(', ')}]`);
        }
        const entry = this.sessions.get(sessionId);
        if (!entry) {
            console.error(`[SSE POST] Invalid session ${sessionId} - session not found!`);
            res.writeHead(400).end('Invalid session');
            return;
        }
        // Pass pre-parsed body from express.json() middleware (like reference implementation)
        // express.json() already read and parsed the body into req.body
        if (!isPing) {
            console.error(`[SSE POST] Calling handlePostMessage with req.body for session ${sessionId}`);
        }
        try {
            await entry.transport.handlePostMessage(req, res, req.body);
            if (!isPing) {
                console.error(`[SSE POST] Successfully processed for session ${sessionId}`);
            }
        }
        catch (error) {
            console.error(`[SSE POST] FAILED for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
            console.error(`[SSE POST] Error stack:`, error);
            if (!res.headersSent) {
                res.writeHead(500).end('Internal Server Error');
            }
        }
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
}
exports.SseServer = SseServer;
//# sourceMappingURL=SseServer.js.map