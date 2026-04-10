"use strict";
/**
 * CreateTable Handler - Create ABAP Table
 *
 * Uses AdtClient.createTable from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateTable = handleCreateTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'CreateTableLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Create a new ABAP table. - use CreateTable (high-level) for full workflow with validation, lock, update, check, unlock, and activate.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., ZT_TEST_001). Must follow SAP naming conventions.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['table_name', 'package_name'],
    },
};
/**
 * Main handler for CreateTable MCP tool
 *
 * Uses AdtClient.createTable - low-level single method call
 */
async function handleCreateTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, package_name, transport_request, session_id, session_state, } = args;
        // Validation
        if (!table_name || !package_name) {
            return (0, utils_1.return_error)(new Error('table_name and package_name are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection);
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
            // Ensure connection is established
        }
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table creation: ${tableName}`);
        try {
            // Create table
            const createState = await client.getTable().create({
                tableName,
                packageName: package_name,
                description: '',
                ddlCode: '',
                transportRequest: transport_request,
            });
            const createResult = createState.createResult;
            if (!createResult) {
                throw new Error(`Create did not return a response for table ${tableName}`);
            }
            // Get updated session state after create
            logger?.info(`✅ CreateTable completed: ${tableName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    package_name: package_name,
                    transport_request: transport_request || null,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Table ${tableName} created successfully. Use LockTable and UpdateTable to add source code, then UnlockTable and ActivateObject.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error creating table ${tableName}:`, error);
            // Parse error message
            let errorMessage = `Failed to create table: ${error.message || String(error)}`;
            if (error.response?.status === 409) {
                errorMessage = `Table ${tableName} already exists.`;
            }
            else if (error.response?.data &&
                typeof error.response.data === 'string') {
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
//# sourceMappingURL=handleCreateTable.js.map