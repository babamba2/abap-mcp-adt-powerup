"use strict";
/**
 * GetTable Handler - Read ABAP Table via AdtClient
 *
 * Uses AdtClient.getTable().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetTable = handleGetTable;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetTable',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP table definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: {
                type: 'string',
                description: 'Table name (e.g., Z_MY_TABLE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['table_name'],
    },
};
/**
 * Main handler for GetTable MCP tool
 *
 * Uses AdtClient.getTable().read() - high-level read operation
 */
async function handleGetTable(context, args) {
    const { connection, logger } = context;
    try {
        const { table_name, version = 'active' } = args;
        // Validation
        if (!table_name) {
            return (0, utils_1.return_error)(new Error('table_name is required'));
        }
        const tableName = table_name.toUpperCase();
        // ECC fallback — standard /sap/bc/adt/ddic/tables endpoint is missing
        // on legacy kernels (BASIS < 7.50). Route through the OData bridge
        // (ZMCP_ADT_DDIC_TABL_READ → DD02L/DD03L/DD02T/DD04T/TADIR).
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            logger?.info(`[ECC bridge] GetTable ${tableName}, version: ${version}`);
            const bridge = await (0, rfcBackend_1.callDdicTablRead)(connection, {
                name: tableName,
                version: version === 'inactive' ? 'I' : 'A',
            });
            if (bridge.subrc !== 0) {
                return (0, utils_1.return_error)(new Error(`ZMCP_ADT_DDIC_TABL_READ subrc=${bridge.subrc}: ${bridge.message}`));
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    version,
                    table_data: JSON.stringify(bridge.result),
                    status: 200,
                    status_text: 'OK',
                    path: 'ecc-odata-rfc',
                }, null, 2),
            });
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        logger?.info(`Reading table ${tableName}, version: ${version}`);
        try {
            // Read table using AdtClient
            const tableObject = client.getTable();
            const readResult = await tableObject.read({ tableName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Table ${tableName} not found`);
            }
            // Extract data from read result
            const tableData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetTable completed successfully: ${tableName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    table_name: tableName,
                    version,
                    table_data: tableData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading table ${tableName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read table: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Table ${tableName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Table ${tableName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetTable.js.map