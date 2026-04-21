"use strict";
/**
 * GetPackage Handler - Read ABAP Package via AdtClient
 *
 * Uses AdtClient.getPackage().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetPackage = handleGetPackage;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetPackage',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Retrieve ABAP package metadata (description, super-package, etc.). Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            package_name: {
                type: 'string',
                description: 'Package name (e.g., Z_MY_PACKAGE).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['package_name'],
    },
};
/**
 * Main handler for GetPackage MCP tool
 *
 * Uses AdtClient.getPackage().read() - high-level read operation
 */
async function handleGetPackage(context, args) {
    const { connection, logger } = context;
    try {
        const { package_name, version = 'active' } = args;
        // Validation
        if (!package_name) {
            return (0, utils_1.return_error)(new Error('package_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const packageName = package_name.toUpperCase();
        logger?.info(`Reading package ${packageName}, version: ${version}`);
        try {
            // Read package using AdtClient
            const packageObject = client.getPackage();
            const readResult = await packageObject.read({ packageName }, version);
            if (!readResult || !readResult.readResult) {
                return (0, utils_1.return_error)(new Error(`Package ${packageName} not found.`));
            }
            // Extract data from read result
            const packageData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            // Detect legacy-limited metadata flag emitted by AdtPackageLegacy.read()
            // so callers can decide whether super-package / transport fields are
            // missing on purpose (not a parse bug).
            const legacyLimited = typeof packageData === 'string' &&
                packageData.includes('pak:legacyLimited="true"');
            logger?.info(`✅ GetPackage completed successfully: ${packageName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    package_name: packageName,
                    version,
                    package_data: packageData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                    ...(legacyLimited
                        ? {
                            legacy_limited: true,
                            legacy_note: 'Legacy SAP system: only name/type/description are reliable. Super-package, application component, software component and transport metadata are not populated.',
                        }
                        : {}),
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading package ${packageName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read package: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Package ${packageName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Package ${packageName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetPackage.js.map