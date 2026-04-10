"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHandlerGroup = void 0;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const schemaUtils_js_1 = require("../utils/schemaUtils.js");
/**
 * Base class for handler groups
 * Provides common functionality for registering handlers
 */
class BaseHandlerGroup {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Gets the name of the handler group
     */
    getName() {
        return this.groupName;
    }
    /**
     * Registers all handlers from this group on the MCP server
     */
    registerHandlers(server) {
        const handlers = this.getHandlers();
        for (const entry of handlers) {
            this.registerToolOnServer(server, entry.toolDefinition.name, entry.toolDefinition.description, entry.toolDefinition.inputSchema, entry.handler);
        }
    }
    /**
     * Helper function to register a tool on McpServer
     * Wraps handler to convert our response format to MCP format
     */
    registerToolOnServer(server, toolName, description, inputSchema, handler) {
        // Convert JSON Schema to Zod if needed, otherwise pass as-is
        const zodSchema = inputSchema &&
            typeof inputSchema === 'object' &&
            inputSchema.type === 'object' &&
            inputSchema.properties
            ? (0, schemaUtils_js_1.jsonSchemaToZod)(inputSchema)
            : inputSchema;
        server.registerTool(toolName, {
            description,
            inputSchema: zodSchema,
        }, async (args) => {
            const result = await handler(this.context, args);
            // If error, throw it
            if (result.isError) {
                const errorText = result.content
                    ?.map((item) => {
                    if (item?.type === 'json' && item.json !== undefined) {
                        return JSON.stringify(item.json);
                    }
                    return item?.text || String(item);
                })
                    .join('\n') || 'Unknown error';
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, errorText);
            }
            // Convert content to MCP format - JSON items become text
            const content = (result.content || []).map((item) => {
                if (item?.type === 'json' && item.json !== undefined) {
                    return {
                        type: 'text',
                        text: JSON.stringify(item.json),
                    };
                }
                return {
                    type: 'text',
                    text: item?.text || String(item || ''),
                };
            });
            return { content };
        });
    }
}
exports.BaseHandlerGroup = BaseHandlerGroup;
//# sourceMappingURL=BaseHandlerGroup.js.map