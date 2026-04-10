"use strict";
/**
 * CreateTransport Handler - Create ABAP Transport Request
 *
 * Uses AdtClient.createTransport from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateTransport = handleCreateTransport;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateTransportLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP transport request.',
    inputSchema: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: 'Transport request description.',
            },
            transport_type: {
                type: 'string',
                description: "Transport type: 'workbench' or 'customizing' (optional, default: 'workbench').",
                enum: ['workbench', 'customizing'],
            },
        },
        required: ['description'],
    },
};
/**
 * Main handler for CreateTransport MCP tool
 *
 * Uses AdtClient.createTransport - low-level single method call
 */
async function handleCreateTransport(context, args) {
    const { connection, logger } = context;
    try {
        const { description, transport_type } = args;
        // Validation
        if (!description) {
            return (0, utils_1.return_error)(new Error('description is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Ensure connection is established
        logger?.info(`Starting transport creation: ${description}`);
        try {
            // Create transport
            const createState = await client.getRequest().create({
                description,
                transportType: transport_type || 'workbench',
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for transport`);
            }
            logger?.info(`✅ CreateTransport completed`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    description,
                    transport_type: transport_type || 'workbench',
                    message: `Transport request created successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating transport:`, error);
            // Parse error message
            let errorMessage = `Failed to create transport: ${error.message || String(error)}`;
            if (error.response?.data && typeof error.response.data === 'string') {
                try {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    const errorData = parser.parse(error.response.data);
                    const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                        errorData['exc:exception']?.message;
                    if (errorMsg) {
                        errorMessage = `SAP Error: ${errorMsg}`;
                    }
                }
                catch (_parseError) {
                    // Ignore parse errors
                }
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateTransport.js.map