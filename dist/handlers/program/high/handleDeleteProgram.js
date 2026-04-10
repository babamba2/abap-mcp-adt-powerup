"use strict";
/**
 * DeleteProgram Handler - Delete ABAP Program via AdtClient
 *
 * Uses AdtClient.getProgram().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleDeleteProgram = handleDeleteProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'DeleteProgram',
    available_in: ['onprem', 'legacy'],
    description: 'Delete an ABAP program from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
            },
        },
        required: ['program_name'],
    },
};
/**
 * Main handler for DeleteProgram MCP tool
 *
 * Uses AdtClient.getProgram().delete() - high-level delete operation with deletion check
 */
async function handleDeleteProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, transport_request } = args;
        // Validation
        if (!program_name) {
            return (0, utils_1.return_error)(new Error('program_name is required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const programName = program_name.toUpperCase();
        logger?.info(`Starting program deletion: ${programName}`);
        try {
            // Delete program using AdtClient (includes deletion check)
            const programObject = client.getProgram();
            const deleteResult = await programObject.delete({
                programName,
                transportRequest: transport_request,
            });
            if (!deleteResult || !deleteResult.deleteResult) {
                throw new Error(`Delete did not return a response for program ${programName}`);
            }
            logger?.info(`✅ DeleteProgram completed successfully: ${programName}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    program_name: programName,
                    transport_request: transport_request || null,
                    message: `Program ${programName} deleted successfully.`,
                }, null, 2),
            });
        }
        catch (error) {
            logger?.error(`Error deleting program ${programName}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to delete program: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Program ${programName} not found. It may already be deleted.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Program ${programName} is locked by another user. Cannot delete.`;
            }
            else if (error.response?.status === 400) {
                errorMessage = `Bad request. Check if transport request is required and valid.`;
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
//# sourceMappingURL=handleDeleteProgram.js.map