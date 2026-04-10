"use strict";
/**
 * UpdateTable Handler - Update Existing ABAP Table DDL Source
 *
 * Uses TableBuilder from @mcp-abap-adt/adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive version) -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateTable = handleUpdateTable;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateTable',
    available_in: ['onprem', 'cloud'],
    description: 'Update DDL source code of an existing ABAP table. Locks the table, uploads new DDL source, and unlocks. Optionally activates after update. Use this to modify existing tables without re-creating metadata.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., ZZ_TEST_TABLE_001). Table must already exist.',
            },
            ddl_code: {
                type: 'string',
                description: "Complete DDL source code for table. Example: '@EndUserText.label : \\'My Table\\' @AbapCatalog.tableCategory : #TRANSPARENT define table ztst_table { key client : abap.clnt not null; key id : abap.char(10); name : abap.char(255); }'",
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Optional if object is local or already in transport.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate table after source update. Default: true.',
            },
        },
        required: ['table_name', 'ddl_code'],
    },
};
/**
 * Main handler for UpdateTable MCP tool
 *
 * Uses TableBuilder from @mcp-abap-adt/adt-clients for all operations
 * Session and lock management handled internally by builder
 */
async function handleUpdateTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, ddl_code, transport_request, activate = true, } = args;
        // Validation
        if (!table_name || !ddl_code) {
            return (0, utils_1.return_error)(new Error('table_name and ddl_code are required'));
        }
        const tableName = table_name.toUpperCase();
        logger?.info(`Starting table source update: ${tableName}`);
        try {
            // Get configuration from environment variables
            // Create logger for connection (only logs when DEBUG_CONNECTORS is enabled)
            // Create connection directly for this handler call
            // Get connection from session context (set by ProtocolHandler)
            // Connection is managed and cached per session, with proper token refresh via AuthBroker
            logger?.debug(`[UpdateTable] Created separate connection for handler call: ${tableName}`);
        }
        catch (connectionError) {
            const errorMessage = connectionError instanceof Error
                ? connectionError.message
                : String(connectionError);
            logger?.error(`[UpdateTable] Failed to create connection: ${errorMessage}`);
            return (0, utils_1.return_error)(new Error(`Failed to create connection: ${errorMessage}`));
        }
        try {
            // Create client
            const client = (0, clients_1.createAdtClient)(connection);
            // Build operation chain: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive version) -> (activate)
            // Note: No validation needed for update - table must already exist
            const shouldActivate = activate !== false; // Default to true if not specified
            let activateResponse;
            let lockHandle;
            try {
                // Lock
                lockHandle = await client.getTable().lock({ tableName });
                // Step 1: Check new code BEFORE update (with ddlCode and version='inactive')
                logger?.info(`[UpdateTable] Checking new DDL code before update: ${tableName}`);
                let checkNewCodePassed = false;
                try {
                    await (0, utils_1.safeCheckOperation)(() => client
                        .getTable()
                        .check({ tableName, ddlCode: ddl_code }, 'inactive'), tableName, {
                        debug: (message) => logger?.debug(`[UpdateTable] ${message}`),
                    });
                    checkNewCodePassed = true;
                    logger?.info(`[UpdateTable] New code check passed: ${tableName}`);
                }
                catch (checkError) {
                    // If error was marked as "already checked", continue silently
                    if (checkError.isAlreadyChecked) {
                        logger?.info(`[UpdateTable] Table ${tableName} was already checked - this is OK, continuing`);
                        checkNewCodePassed = true;
                    }
                    else {
                        // Real check error - don't update if check failed
                        logger?.error(`[UpdateTable] New code check failed: ${tableName}`, {
                            error: checkError instanceof Error
                                ? checkError.message
                                : String(checkError),
                        });
                        throw new Error(`New code check failed: ${checkError instanceof Error ? checkError.message : String(checkError)}`);
                    }
                }
                // Step 2: Update (only if check passed)
                if (checkNewCodePassed) {
                    logger?.info(`[UpdateTable] Updating table with DDL code: ${tableName}`);
                    await client.getTable().update({
                        tableName,
                        ddlCode: ddl_code,
                        transportRequest: transport_request,
                    }, { lockHandle });
                    logger?.info(`[UpdateTable] Table source code updated: ${tableName}`);
                }
                else {
                    logger?.info(`[UpdateTable] Skipping update - new code check failed: ${tableName}`);
                }
            }
            finally {
                if (lockHandle) {
                    try {
                        await client.getTable().unlock({ tableName }, lockHandle);
                        logger?.info(`[UpdateTable] Table unlocked: ${tableName}`);
                    }
                    catch (unlockError) {
                        logger?.warn(`Failed to unlock table ${tableName}: ${unlockError?.message || unlockError}`);
                    }
                }
            }
            // Step 4: Check inactive version (after unlock)
            logger?.info(`[UpdateTable] Checking inactive version: ${tableName}`);
            try {
                await (0, utils_1.safeCheckOperation)(() => client.getTable().check({ tableName }, 'inactive'), tableName, {
                    debug: (message) => logger?.debug(`[UpdateTable] ${message}`),
                });
                logger?.info(`[UpdateTable] Inactive version check completed: ${tableName}`);
            }
            catch (checkError) {
                // If error was marked as "already checked", continue silently
                if (checkError.isAlreadyChecked) {
                    logger?.info(`[UpdateTable] Table ${tableName} was already checked - this is OK, continuing`);
                }
                else {
                    // Log warning but don't fail - inactive check is informational
                    logger?.warn(`[UpdateTable] Inactive version check had issues: ${tableName}`, {
                        error: checkError instanceof Error
                            ? checkError.message
                            : String(checkError),
                    });
                }
            }
            // Activate if requested
            if (shouldActivate) {
                const activateState = await client.getTable().activate({ tableName });
                activateResponse = activateState.activateResult;
            }
            // Parse activation warnings if activation was performed
            let activationWarnings = [];
            if (shouldActivate &&
                activateResponse &&
                typeof activateResponse.data === 'string' &&
                activateResponse.data.includes('<chkl:messages')) {
                const parser = new fast_xml_parser_1.XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const result = parser.parse(activateResponse.data);
                const messages = result?.['chkl:messages']?.msg;
                if (messages) {
                    const msgArray = Array.isArray(messages) ? messages : [messages];
                    activationWarnings = msgArray.map((msg) => `${msg['@_type']}: ${msg.shortText?.txt || 'Unknown'}`);
                }
            }
            logger?.info(`✅ UpdateTable completed successfully: ${tableName}`);
            // Return success result
            const stepsCompleted = [
                'lock',
                'check_new_code',
                'update',
                'unlock',
                'check_inactive',
            ];
            if (shouldActivate) {
                stepsCompleted.push('activate');
            }
            const result = {
                success: true,
                table_name: tableName,
                transport_request: transport_request || 'local',
                activated: shouldActivate,
                message: shouldActivate
                    ? `Table ${tableName} source updated and activated successfully`
                    : `Table ${tableName} source updated successfully (not activated)`,
                uri: `/sap/bc/adt/ddic/tables/${(0, utils_1.encodeSapObjectName)(tableName)}`,
                steps_completed: stepsCompleted,
                activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
                source_size_bytes: ddl_code.length,
            };
            return (0, utils_1.return_response)({
                data: JSON.stringify(result, null, 2),
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            });
        }
        catch (error) {
            logger?.error(`Error updating table source ${tableName}:`, error);
            const errorMessage = error.response?.data
                ? typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data)
                : error.message || String(error);
            return (0, utils_1.return_error)(new Error(`Failed to update table: ${errorMessage}`));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateTable.js.map