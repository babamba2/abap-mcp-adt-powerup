"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeHandlersRegistry = void 0;
/**
 * Composite handlers registry that accepts multiple handler groups via Dependency Injection
 * Allows flexible composition of handler sets based on requirements
 */
class CompositeHandlersRegistry {
    registeredTools = new Set();
    handlerGroups;
    failOnDuplicate;
    /**
     * Creates a composite registry with the specified handler groups
     * @param handlerGroups - Array of handler groups to register
     * @param failOnDuplicate - When true, throws on duplicate tool names (useful in dev)
     */
    constructor(handlerGroups = [], failOnDuplicate = true) {
        this.handlerGroups = handlerGroups;
        this.failOnDuplicate = failOnDuplicate;
    }
    /**
     * Adds a handler group to the registry
     * @param group - Handler group to add
     */
    addHandlerGroup(group) {
        this.handlerGroups.push(group);
    }
    /**
     * Removes a handler group from the registry
     * @param groupName - Name of the group to remove
     */
    removeHandlerGroup(groupName) {
        this.handlerGroups = this.handlerGroups.filter((g) => g.getName() !== groupName);
    }
    /**
     * Gets all handler groups in this registry
     */
    getHandlerGroups() {
        return [...this.handlerGroups];
    }
    /**
     * Registers all tools from all handler groups on MCP server
     */
    registerAllTools(server) {
        this.registeredTools.clear();
        for (const group of this.handlerGroups) {
            const handlers = group.getHandlers();
            for (const entry of handlers) {
                const name = entry.toolDefinition.name;
                if (this.registeredTools.has(name)) {
                    const msg = `Duplicate tool registration detected: "${name}" in group "${group.getName()}"`;
                    if (this.failOnDuplicate) {
                        throw new Error(msg);
                    }
                    // Skip duplicate if not failing
                    continue;
                }
                this.registeredTools.add(name);
            }
            // Use group's own registration logic (preserves schema conversions)
            group.registerHandlers(server);
        }
    }
    /**
     * Registers a single tool on server
     * Note: This method is provided for compatibility, but it's recommended to use handler groups
     */
    registerTool(server, toolName, toolDefinition, handler) {
        server.registerTool(toolName, {
            description: toolDefinition.description,
            inputSchema: toolDefinition.inputSchema,
        }, handler);
    }
    /**
     * Gets list of registered tools
     */
    getRegisteredTools() {
        return Array.from(this.registeredTools);
    }
    /**
     * Gets list of handler group names
     */
    getHandlerGroupNames() {
        return this.handlerGroups.map((g) => g.getName());
    }
}
exports.CompositeHandlersRegistry = CompositeHandlersRegistry;
//# sourceMappingURL=CompositeHandlersRegistry.js.map