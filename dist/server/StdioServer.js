"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioServer = void 0;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const handlerLogger_js_1 = require("../lib/handlerLogger.js");
const profileEvents_js_1 = require("../lib/profileEvents.js");
const BaseMcpServer_js_1 = require("./BaseMcpServer.js");
const DEFAULT_VERSION = process.env.npm_package_version ?? '1.0.0';
/**
 * Minimal stdio server implementation based on BaseMcpServer.
 * Sets connection context once at startup and connects stdio transport.
 */
class StdioServer extends BaseMcpServer_js_1.BaseMcpServer {
    handlersRegistry;
    broker;
    constructor(handlersRegistry, broker, opts) {
        super({
            name: opts?.name ?? 'mcp-abap-adt',
            version: opts?.version ?? DEFAULT_VERSION,
            logger: opts?.logger ?? handlerLogger_js_1.noopLogger,
        });
        this.handlersRegistry = handlersRegistry;
        this.broker = broker;
    }
    async start(destination) {
        await this.setConnectionContext(destination, this.broker);
        // One process, one context: follow ReloadProfile instead of staying on
        // the system that was active at boot. (Per-request SSE/HTTP servers
        // build a fresh context per request and do not need this.)
        (0, profileEvents_js_1.registerProfileChangeHook)((loaded) => {
            if (!this.rebindToProfile(loaded)) {
                throw new Error(`connection could not be rebound to profile ${loaded.alias ?? '(legacy)'} — restart the MCP server`);
            }
        });
        this.registerHandlers(this.handlersRegistry);
        const transport = new stdio_js_1.StdioServerTransport();
        await this.connect(transport);
    }
}
exports.StdioServer = StdioServer;
//# sourceMappingURL=StdioServer.js.map