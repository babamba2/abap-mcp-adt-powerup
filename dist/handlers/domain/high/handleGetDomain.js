"use strict";
/**
 * GetDomain Handler - Read ABAP Domain via AdtClient
 *
 * Uses AdtClient.getDomain().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetDomain = handleGetDomain;
const clients_1 = require("../../../lib/clients");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetDomain',
    available_in: ['onprem', 'cloud'],
    description: 'Retrieve ABAP domain definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            domain_name: {
                type: 'string',
                description: 'Domain name (e.g., Z_MY_DOMAIN).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['domain_name'],
    },
};
/**
 * Main handler for GetDomain MCP tool
 *
 * Uses AdtClient.getDomain().read() - high-level read operation
 */
async function handleGetDomain(context, args) {
    const { connection, logger } = context;
    try {
        const { domain_name, version = 'active' } = args;
        // Validation
        if (!domain_name) {
            return (0, utils_1.return_error)(new Error('domain_name is required'));
        }
        const domainName = domain_name.toUpperCase();
        // ECC fallback — standard /sap/bc/adt/ddic/domains endpoint is missing
        // on legacy kernels (BASIS < 7.50). Route through the OData bridge
        // (ZMCP_ADT_DDIC_DOMA_READ → DD01L/DD01T/DD07L/DD07T/TADIR).
        if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
            logger?.info(`[ECC bridge] GetDomain ${domainName}, version: ${version}`);
            const bridge = await (0, rfcBackend_1.callDdicDomaRead)(connection, {
                name: domainName,
                version: version === 'inactive' ? 'I' : 'A',
            });
            if (bridge.subrc !== 0) {
                return (0, utils_1.return_error)(new Error(`ZMCP_ADT_DDIC_DOMA_READ subrc=${bridge.subrc}: ${bridge.message}`));
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    version,
                    domain_data: JSON.stringify(bridge.result),
                    status: 200,
                    status_text: 'OK',
                    path: 'ecc-odata-rfc',
                }, null, 2),
            });
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        logger?.info(`Reading domain ${domainName}, version: ${version}`);
        try {
            // Read domain using AdtClient
            const domainObject = client.getDomain();
            const readResult = await domainObject.read({ domainName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Domain ${domainName} not found`);
            }
            // Extract data from read result
            const domainData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetDomain completed successfully: ${domainName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    domain_name: domainName,
                    version,
                    domain_data: domainData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading domain ${domainName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read domain: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Domain ${domainName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Domain ${domainName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetDomain.js.map