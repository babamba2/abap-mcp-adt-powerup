"use strict";
/**
 * GetDataElement Handler - Read ABAP Data Element via AdtClient
 *
 * Uses AdtClient.getDataElement().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetDataElement = handleGetDataElement;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetDataElement',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP data element definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            data_element_name: {
                type: 'string',
                description: 'Data element name (e.g., Z_MY_DATA_ELEMENT).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['data_element_name'],
    },
};
/**
 * Main handler for GetDataElement MCP tool
 *
 * Uses AdtClient.getDataElement().read() - high-level read operation
 */
async function handleGetDataElement(context, args) {
    const { connection, logger } = context;
    try {
        const { data_element_name, version = 'active' } = args;
        // Validation
        if (!data_element_name) {
            return (0, utils_1.return_error)(new Error('data_element_name is required'));
        }
        const dataElementName = data_element_name.toUpperCase();
        // ECC fallback — standard /sap/bc/adt/ddic/dataelements endpoint is
        // missing on legacy kernels (BASIS < 7.50). Route through the OData
        // bridge (ZMCP_ADT_DDIC_DTEL_READ → DD04L/DD04T/TADIR).
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            logger?.info(`[ECC bridge] GetDataElement ${dataElementName}, version: ${version}`);
            const bridge = await (0, rfcBackend_1.callDdicDtelRead)(connection, {
                name: dataElementName,
                version: version === 'inactive' ? 'I' : 'A',
            });
            if (bridge.subrc !== 0) {
                return (0, utils_1.return_error)(new Error(`ZMCP_ADT_DDIC_DTEL_READ subrc=${bridge.subrc}: ${bridge.message}`));
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    version,
                    data_element_data: JSON.stringify(bridge.result),
                    status: 200,
                    status_text: 'OK',
                    path: 'ecc-odata-rfc',
                }, null, 2),
            });
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        logger?.info(`Reading data element ${dataElementName}, version: ${version}`);
        try {
            // Read data element using AdtClient
            const dataElementObject = client.getDataElement();
            const readResult = await dataElementObject.read({ dataElementName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Data element ${dataElementName} not found`);
            }
            // Extract data from read result
            const dataElementData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetDataElement completed successfully: ${dataElementName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    data_element_name: dataElementName,
                    version,
                    data_element_data: dataElementData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading data element ${dataElementName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read data element: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Data element ${dataElementName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Data element ${dataElementName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetDataElement.js.map