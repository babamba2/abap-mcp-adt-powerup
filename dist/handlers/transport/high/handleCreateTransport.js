"use strict";
/**
 * CreateTransport Handler - Create new ABAP transport request via ADT API
 *
 * Uses TransportBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: create
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateTransport = handleCreateTransport;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateTransport',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP transport request in SAP system for development objects.',
    inputSchema: {
        type: 'object',
        properties: {
            transport_type: {
                type: 'string',
                description: "Transport type: 'workbench' (cross-client) or 'customizing' (client-specific)",
                enum: ['workbench', 'customizing'],
                default: 'workbench',
            },
            description: {
                type: 'string',
                description: 'Transport request description (mandatory)',
            },
            target_system: {
                type: 'string',
                description: "Target system for transport (optional, e.g., 'PRD', 'QAS'). If not provided or empty, uses 'LOCAL'",
            },
            owner: {
                type: 'string',
                description: 'Transport owner (optional, defaults to current user)',
            },
        },
        required: ['description'],
    },
};
/**
 * Main handler for CreateTransport MCP tool
 *
 * Uses TransportBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleCreateTransport(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.description) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Transport description is required');
        }
        const typedArgs = args;
        // Get connection from session context (set by ProtocolHandler)
        // Connection is managed and cached per session, with proper token refresh via AuthBroker
        logger?.info(`Starting transport creation: ${typedArgs.description}`);
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Create transport
            const createState = await client.getRequest().create({
                description: typedArgs.description,
                transportType: typedArgs.transport_type === 'customizing'
                    ? 'customizing'
                    : 'workbench',
                targetSystem: typedArgs.target_system,
                owner: typedArgs.owner,
            });
            // Get create result
            const createResult = createState.createResult;
            logger?.info(`✅ CreateTransport completed successfully`);
            // Parse response data if available
            let transportInfo = {};
            let transportNumber;
            let taskNumber;
            if (createResult?.data) {
                if (typeof createResult.data === 'string') {
                    // If data is XML string, try to parse it
                    try {
                        const { XMLParser } = require('fast-xml-parser');
                        const parser = new XMLParser({
                            ignoreAttributes: false,
                            attributeNamePrefix: '',
                            parseAttributeValue: true,
                        });
                        const result = parser.parse(createResult.data);
                        const root = result['tm:root'] || result.root;
                        const request = root?.['tm:request'] || {};
                        const task = request?.['tm:task'] || {};
                        transportInfo = {
                            transport_number: request['tm:number'] || transportNumber,
                            description: request['tm:desc'] ||
                                request['tm:description'] ||
                                typedArgs.description,
                            type: request['tm:type'],
                            target_system: request['tm:target'],
                            target_desc: request['tm:target_desc'],
                            cts_project: request['tm:cts_project'],
                            uri: request['tm:uri'],
                            owner: task['tm:owner'] || request['tm:owner'] || typedArgs.owner,
                        };
                    }
                    catch (_parseError) {
                        // If parsing fails, use basic info
                        transportInfo = {
                            transport_number: transportNumber,
                            description: typedArgs.description,
                            type: typedArgs.transport_type === 'customizing' ? 'T' : 'K',
                            owner: typedArgs.owner,
                        };
                    }
                }
                else if (typeof createResult.data === 'object') {
                    transportInfo = createResult.data;
                }
            }
            // Use builder state if response parsing didn't provide transport number
            if (!transportInfo.transport_number && transportNumber) {
                transportInfo.transport_number = transportNumber;
            }
            if (!transportInfo.task_number && taskNumber) {
                transportInfo.task_number = taskNumber;
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    transport_request: transportInfo.transport_number || transportNumber,
                    task_number: transportInfo.task_number || taskNumber,
                    description: transportInfo.description || typedArgs.description,
                    type: transportInfo.type ||
                        (typedArgs.transport_type === 'customizing' ? 'T' : 'K'),
                    target_system: transportInfo.target_system || typedArgs.target_system || 'LOCAL',
                    target_desc: transportInfo.target_desc,
                    cts_project: transportInfo.cts_project,
                    owner: transportInfo.owner || typedArgs.owner,
                    uri: transportInfo.uri,
                    message: `Transport request ${transportInfo.transport_number || transportNumber || 'unknown'} created successfully`,
                }, null, 2),
                status: createResult?.status || 200,
                statusText: createResult?.statusText || 'OK',
                headers: (createResult?.headers || {}),
                config: createResult?.config || {},
            });
        }
        catch (error) {
            logger?.error(`Error creating transport:`, error);
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create transport: ${errorMessage}`);
        }
    }
    catch (error) {
        if (error instanceof utils_1.McpError) {
            throw error;
        }
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateTransport.js.map