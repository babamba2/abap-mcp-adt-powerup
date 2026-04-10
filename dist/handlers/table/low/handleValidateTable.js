"use strict";
/**
 * ValidateTable Handler - Validate ABAP table name via ADT API
 *
 * Uses validateTableName from @mcp-abap-adt/adt-clients/core/table for table-specific validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleValidateTable = handleValidateTable;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ValidateTableLow',
    available_in: ['onprem', 'cloud'],
    description: '[low-level] Validate an ABAP table name before creation. Checks if the name is valid and available. Can use session_id and session_state from GetSession to maintain the same session.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name to validate (e.g., Z_MY_TABLE)',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects). Required for validation.',
            },
            description: {
                type: 'string',
                description: 'Table description. Required for validation.',
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
        required: ['table_name', 'package_name', 'description'],
    },
};
/**
 * Main handler for ValidateTable MCP tool
 */
async function handleValidateTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, package_name, description, session_id, session_state } = args;
        if (!table_name || !package_name || !description) {
            return (0, utils_1.return_error)(new Error('table_name, package_name, and description are required'));
        }
        // Restore session state if provided
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table validation: ${tableName}`);
        try {
            const client = (0, clients_1.createAdtClient)(connection);
            const validationState = await client.getTable().validate({
                tableName: tableName,
                packageName: package_name.toUpperCase(),
                description: description,
            });
            const validationResponse = validationState.validationResponse;
            if (!validationResponse) {
                throw new Error('Validation did not return a result');
            }
            const result = (0, utils_1.parseValidationResponse)(validationResponse);
            // Get updated session state after validation
            logger?.info(`✅ ValidateTable completed: ${tableName}`);
            logger?.info(`   Valid: ${result.valid}, Message: ${result.message || 'N/A'}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: result.valid,
                    table_name: tableName,
                    description: description || null,
                    validation_result: result,
                    session_id: session_id || null,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: result.valid
                        ? `Table name ${tableName} is valid and available`
                        : `Table name ${tableName} validation failed: ${result.message || 'Unknown error'}`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error validating table ${tableName}:`, error);
            let errorMessage = `Failed to validate table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found.`;
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
//# sourceMappingURL=handleValidateTable.js.map