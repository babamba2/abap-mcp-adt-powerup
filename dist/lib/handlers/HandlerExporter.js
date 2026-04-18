"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandlerExporter = void 0;
exports.createDefaultHandlerExporter = createDefaultHandlerExporter;
const mcp_abap_adt_logger_1 = require("@babamba2/mcp-abap-adt-logger");
const CompactHandlersGroup_js_1 = require("./groups/CompactHandlersGroup.js");
const HighLevelHandlersGroup_js_1 = require("./groups/HighLevelHandlersGroup.js");
const LowLevelHandlersGroup_js_1 = require("./groups/LowLevelHandlersGroup.js");
const ReadOnlyHandlersGroup_js_1 = require("./groups/ReadOnlyHandlersGroup.js");
const SearchHandlersGroup_js_1 = require("./groups/SearchHandlersGroup.js");
const SystemHandlersGroup_js_1 = require("./groups/SystemHandlersGroup.js");
const CompositeHandlersRegistry_js_1 = require("./registry/CompositeHandlersRegistry.js");
/**
 * Handler Exporter - factory for creating handlers registry
 *
 * This class provides a way to create handlers registry with configurable
 * exposition levels. Use with EmbeddableMcpServer for external integration.
 *
 * Usage:
 * ```typescript
 * import { HandlerExporter, EmbeddableMcpServer } from '@mcp-abap-adt/core';
 *
 * // Create exporter with specific handlers
 * const exporter = new HandlerExporter({
 *   includeReadOnly: true,
 *   includeHighLevel: true,
 *   includeLowLevel: false,
 * });
 *
 * // Use with EmbeddableMcpServer
 * const server = new EmbeddableMcpServer({
 *   connection: myConnection,
 *   handlersRegistry: exporter.createRegistry(),
 * });
 * ```
 */
class HandlerExporter {
    logger;
    handlerGroups;
    constructor(options) {
        this.logger = options?.logger ?? mcp_abap_adt_logger_1.defaultLogger;
        // Create dummy context for group instantiation
        // Real context is provided by BaseMcpServer.registerHandlers() via getConnection()
        const dummyContext = {
            connection: null,
            logger: this.logger,
        };
        // Build handler groups based on options
        this.handlerGroups = [];
        if (options?.includeReadOnly !== false) {
            this.handlerGroups.push(new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(dummyContext));
        }
        if (options?.includeHighLevel !== false) {
            this.handlerGroups.push(new HighLevelHandlersGroup_js_1.HighLevelHandlersGroup(dummyContext));
        }
        if (options?.includeCompact === true) {
            this.handlerGroups.push(new CompactHandlersGroup_js_1.CompactHandlersGroup(dummyContext));
        }
        if (options?.includeLowLevel !== false) {
            this.handlerGroups.push(new LowLevelHandlersGroup_js_1.LowLevelHandlersGroup(dummyContext));
        }
        if (options?.includeSystem !== false) {
            this.handlerGroups.push(new SystemHandlersGroup_js_1.SystemHandlersGroup(dummyContext));
        }
        if (options?.includeSearch !== false) {
            this.handlerGroups.push(new SearchHandlersGroup_js_1.SearchHandlersGroup(dummyContext));
        }
    }
    /**
     * Get all handler entries
     * Useful for inspection or custom registration logic
     */
    getHandlerEntries() {
        const entries = [];
        for (const group of this.handlerGroups) {
            entries.push(...group.getHandlers());
        }
        return entries;
    }
    /**
     * Get list of tool names
     */
    getToolNames() {
        return this.getHandlerEntries().map((e) => e.toolDefinition.name);
    }
    /**
     * Create handlers registry for use with EmbeddableMcpServer or BaseMcpServer
     */
    createRegistry() {
        return new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry(this.handlerGroups);
    }
}
exports.HandlerExporter = HandlerExporter;
/**
 * Create default handler exporter with all handler groups
 */
function createDefaultHandlerExporter(logger) {
    return new HandlerExporter({ logger });
}
//# sourceMappingURL=HandlerExporter.js.map