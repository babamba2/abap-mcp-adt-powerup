"use strict";
/**
 * GetProgram Handler - Read ABAP Program via AdtClient
 *
 * Uses AdtClient.getProgram().read() for high-level read operation.
 * Supports both active and inactive versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetProgram = handleGetProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetProgram',
    available_in: ['onprem', 'legacy'],
    description: 'Retrieve ABAP program definition. Supports reading active or inactive version.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) for deployed version, "inactive" for modified but not activated version.',
                default: 'active',
            },
        },
        required: ['program_name'],
    },
};
/**
 * Main handler for GetProgram MCP tool
 *
 * Uses AdtClient.getProgram().read() - high-level read operation
 */
async function handleGetProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, version = 'active' } = args;
        // Validation
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const programName = program_name.toUpperCase();
        logger?.info(`Reading program ${programName}, version: ${version}`);
        try {
            // Read program using AdtClient
            const programObject = client.getProgram();
            const readResult = await programObject.read({ programName }, version);
            if (!readResult || !readResult.readResult) {
                throw new Error(`Program ${programName} not found`);
            }
            // Extract data from read result
            const programData = typeof readResult.readResult.data === 'string'
                ? readResult.readResult.data
                : JSON.stringify(readResult.readResult.data);
            logger?.info(`✅ GetProgram completed successfully: ${programName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    version,
                    program_data: programData,
                    status: readResult.readResult.status,
                    status_text: readResult.readResult.statusText,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error reading program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to read program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Program ${programName} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetProgram.js.map