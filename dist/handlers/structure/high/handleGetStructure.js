"use strict";
/**
 * GetStructure Handler - Read ABAP Structure via AdtClient
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetStructure = handleGetStructure;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetStructure',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP structure definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            structure_name: {
                type: 'string',
                description: 'Structure name (e.g., Z_MY_STRUCTURE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['structure_name'],
    },
};
async function handleGetStructure(context, args) {
    const { connection, logger } = context;
    try {
        const { structure_name, version = 'active' } = args;
        if (!structure_name) {
            return (0, utils_1.return_error)(new Error('structure_name is required'));
        }
        const structureName = structure_name.toUpperCase();
        // ECC fallback — standard /sap/bc/adt/ddic/tables endpoint is missing
        // on legacy kernels. The same bridge FM (ZMCP_ADT_DDIC_TABL_READ)
        // handles both transparent tables and structures (TABCLASS branch).
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            logger?.info(`[ECC bridge] GetStructure ${structureName}, version: ${version}`);
            const bridge = await (0, rfcBackend_1.callDdicTablRead)(connection, {
                name: structureName,
                version: version === 'inactive' ? 'I' : 'A',
            });
            if (bridge.subrc !== 0) {
                return (0, utils_1.return_error)(new Error(`ZMCP_ADT_DDIC_TABL_READ subrc=${bridge.subrc}: ${bridge.message}`));
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    version,
                    structure_data: JSON.stringify(bridge.result),
                    status: 200,
                    status_text: 'OK',
                    path: 'ecc-odata-rfc',
                }, null, 2),
            });
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        logger?.info(`Reading structure ${structureName}, version: ${version}`);
        try {
            const structureObject = client.getStructure();
            const readResult = await structureObject.read({ structureName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Structure ${structureName} not found`);
            }
            const structureData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetStructure completed successfully: ${structureName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    structure_name: structureName,
                    version,
                    structure_data: structureData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading structure ${structureName}: ${error?.message || error}`);
            let errorMessage = `Failed to read structure: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Structure ${structureName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Structure ${structureName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetStructure.js.map