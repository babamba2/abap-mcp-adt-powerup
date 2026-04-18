"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddableMcpServer = void 0;
const node_module_1 = require("node:module");
const CompactHandlersGroup_js_1 = require("../lib/handlers/groups/CompactHandlersGroup.js");
const HighLevelHandlersGroup_js_1 = require("../lib/handlers/groups/HighLevelHandlersGroup.js");
const LowLevelHandlersGroup_js_1 = require("../lib/handlers/groups/LowLevelHandlersGroup.js");
const ReadOnlyHandlersGroup_js_1 = require("../lib/handlers/groups/ReadOnlyHandlersGroup.js");
const SearchHandlersGroup_js_1 = require("../lib/handlers/groups/SearchHandlersGroup.js");
const SystemHandlersGroup_js_1 = require("../lib/handlers/groups/SystemHandlersGroup.js");
const CompositeHandlersRegistry_js_1 = require("../lib/handlers/registry/CompositeHandlersRegistry.js");
const BaseMcpServer_js_1 = require("./BaseMcpServer.js");
const DEFAULT_VERSION = process.env.npm_package_version ?? '1.0.0';
/**
 * Embeddable MCP Server for integration with external applications
 *
 * This server is designed for consumers like cloud-llm-hub that:
 * - Have their own connection management (e.g., BTP destinations, Cloud SDK)
 * - Create new server instance per request (SSE/HTTP mode)
 * - Need to inject connection from outside
 *
 * Usage:
 * ```typescript
 * // Create connection (consumer's own implementation)
 * const connection = new CloudSdkAbapConnection(config);
 *
 * // Create embeddable server with injected connection
 * const server = new EmbeddableMcpServer({
 *   connection,
 *   logger: myLogger,
 *   exposition: ['readonly', 'high'],
 * });
 *
 * // Connect transport and handle request
 * await server.connect(transport);
 * ```
 */
class EmbeddableMcpServer extends BaseMcpServer_js_1.BaseMcpServer {
    injectedConnection;
    constructor(options) {
        super({
            name: 'mcp-abap-adt',
            version: options.version ?? DEFAULT_VERSION,
            logger: options.logger,
        });
        this.injectedConnection = options.connection;
        // Use provided registry or create default based on exposition
        const registry = options.handlersRegistry ??
            this.createDefaultRegistry(options.exposition ?? ['readonly', 'high'], options.logger);
        this.registerHandlers(registry);
    }
    /**
     * Returns the injected connection
     * Called by BaseMcpServer.registerHandlers() wrapper lambdas
     */
    async getConnection() {
        return this.injectedConnection;
    }
    /**
     * Creates default handlers registry based on exposition levels
     */
    createDefaultRegistry(exposition, logger) {
        // Dummy context - not actually used because BaseMcpServer.registerHandlers()
        // creates wrapper lambdas that call getConnection() for fresh context
        const dummyContext = {
            connection: null,
            logger: logger ?? getDefaultLogger(),
        };
        const groups = [];
        if (exposition.includes('readonly')) {
            groups.push(new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(dummyContext));
        }
        if (exposition.includes('high')) {
            groups.push(new HighLevelHandlersGroup_js_1.HighLevelHandlersGroup(dummyContext));
        }
        if (exposition.includes('compact')) {
            groups.push(new CompactHandlersGroup_js_1.CompactHandlersGroup(dummyContext));
        }
        if (exposition.includes('low')) {
            groups.push(new LowLevelHandlersGroup_js_1.LowLevelHandlersGroup(dummyContext));
        }
        if (exposition.includes('system')) {
            groups.push(new SystemHandlersGroup_js_1.SystemHandlersGroup(dummyContext));
        }
        if (exposition.includes('search')) {
            groups.push(new SearchHandlersGroup_js_1.SearchHandlersGroup(dummyContext));
        }
        return new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry(groups);
    }
}
exports.EmbeddableMcpServer = EmbeddableMcpServer;
function getDefaultLogger() {
    const require = (0, node_module_1.createRequire)(__filename);
    const mod = require('@babamba2/mcp-abap-adt-logger');
    return mod.defaultLogger ?? new mod.DefaultLogger();
}
//# sourceMappingURL=EmbeddableMcpServer.js.map