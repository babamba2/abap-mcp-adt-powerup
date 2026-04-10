"use strict";
/**
 * Example usage of handler registration system with Dependency Injection
 *
 * This example demonstrates how to use handler groups to create different
 * server configurations with different sets of handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadOnlyServer = createReadOnlyServer;
exports.createFullServer = createFullServer;
exports.createDynamicServer = createDynamicServer;
exports.createCustomServer = createCustomServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const HighLevelHandlersGroup_js_1 = require("../groups/HighLevelHandlersGroup.js");
const LowLevelHandlersGroup_js_1 = require("../groups/LowLevelHandlersGroup.js");
const ReadOnlyHandlersGroup_js_1 = require("../groups/ReadOnlyHandlersGroup.js");
const SearchHandlersGroup_js_1 = require("../groups/SearchHandlersGroup.js");
const SystemHandlersGroup_js_1 = require("../groups/SystemHandlersGroup.js");
const CompositeHandlersRegistry_js_1 = require("../registry/CompositeHandlersRegistry.js");
/**
 * Example 1: Read-only server (e.g., for public API)
 * Only registers read-only handlers, system handlers, and search handlers
 */
function createReadOnlyServer(context) {
    const { connection, logger } = context;
    const mcpServer = new mcp_js_1.McpServer({
        name: 'mcp-abap-adt-readonly',
        version: '1.0.0',
    });
    const handlersRegistry = new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry([
        new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(context),
        new SystemHandlersGroup_js_1.SystemHandlersGroup(context),
        new SearchHandlersGroup_js_1.SearchHandlersGroup(context),
    ]);
    handlersRegistry.registerAllTools(mcpServer);
    return mcpServer;
}
/**
 * Example 2: Full-featured server
 * Registers all handler groups
 */
function createFullServer(context) {
    const mcpServer = new mcp_js_1.McpServer({
        name: 'mcp-abap-adt-full',
        version: '1.0.0',
    });
    const handlersRegistry = new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry([
        new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(context),
        new HighLevelHandlersGroup_js_1.HighLevelHandlersGroup(context),
        new LowLevelHandlersGroup_js_1.LowLevelHandlersGroup(context),
        new SystemHandlersGroup_js_1.SystemHandlersGroup(context),
        new SearchHandlersGroup_js_1.SearchHandlersGroup(context),
    ]);
    handlersRegistry.registerAllTools(mcpServer);
    return mcpServer;
}
/**
 * Example 3: Dynamic handler group management
 * Add/remove handler groups at runtime
 */
function createDynamicServer(context) {
    const { connection, logger } = context;
    const mcpServer = new mcp_js_1.McpServer({
        name: 'mcp-abap-adt-dynamic',
        version: '1.0.0',
    });
    const handlersRegistry = new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry();
    // Add groups dynamically
    handlersRegistry.addHandlerGroup(new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(context));
    handlersRegistry.addHandlerGroup(new HighLevelHandlersGroup_js_1.HighLevelHandlersGroup(context));
    handlersRegistry.addHandlerGroup(new SystemHandlersGroup_js_1.SystemHandlersGroup(context));
    handlersRegistry.addHandlerGroup(new SearchHandlersGroup_js_1.SearchHandlersGroup(context));
    // Register all tools
    handlersRegistry.registerAllTools(mcpServer);
    // Get information about registered groups
    console.log('Handler groups:', handlersRegistry.getHandlerGroupNames());
    console.log('Registered tools:', handlersRegistry.getRegisteredTools());
    // Remove a group if needed
    // handlersRegistry.removeHandlerGroup("HighLevelHandlers");
    // Add low-level handlers if needed
    handlersRegistry.addHandlerGroup(new LowLevelHandlersGroup_js_1.LowLevelHandlersGroup(context));
    return mcpServer;
}
/**
 * Example 4: Custom server configuration
 * Create a server with only specific handler groups
 */
function createCustomServer(includeReadOnly = true, context) {
    const mcpServer = new mcp_js_1.McpServer({
        name: 'mcp-abap-adt-custom',
        version: '1.0.0',
    });
    const handlerGroups = [];
    if (includeReadOnly) {
        handlerGroups.push(new ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup(context));
    }
    // Add other groups based on configuration
    // if (config.includeHighLevel) {
    //   handlerGroups.push(new HighLevelHandlersGroup() as IHandlerGroup);
    // }
    // if (config.includeLowLevel) {
    //   handlerGroups.push(new LowLevelHandlersGroup() as IHandlerGroup);
    // }
    // if (config.includeSystem) {
    //   handlerGroups.push(new SystemHandlersGroup() as IHandlerGroup);
    // }
    // if (config.includeSearch) {
    //   handlerGroups.push(new SearchHandlersGroup() as IHandlerGroup);
    // }
    // Example: Add high-level, low-level, system, and search groups
    handlerGroups.push(new HighLevelHandlersGroup_js_1.HighLevelHandlersGroup(context));
    handlerGroups.push(new LowLevelHandlersGroup_js_1.LowLevelHandlersGroup(context));
    handlerGroups.push(new SystemHandlersGroup_js_1.SystemHandlersGroup(context));
    handlerGroups.push(new SearchHandlersGroup_js_1.SearchHandlersGroup(context));
    const handlersRegistry = new CompositeHandlersRegistry_js_1.CompositeHandlersRegistry(handlerGroups);
    handlersRegistry.registerAllTools(mcpServer);
    return mcpServer;
}
//# sourceMappingURL=usage-example.js.map