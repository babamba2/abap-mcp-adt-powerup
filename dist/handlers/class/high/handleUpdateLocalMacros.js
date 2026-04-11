"use strict";
/**
 * UpdateLocalMacros Handler - Update Local Macros via AdtClient
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateLocalMacros = handleUpdateLocalMacros;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateLocalMacros',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update local macros in an ABAP class (macros include). Manages lock, check, update, unlock, and optional activation. Note: Macros are supported in older ABAP versions but not in newer ones.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Parent class name (e.g., ZCL_MY_CLASS).',
            },
            macros_code: {
                type: 'string',
                description: 'Updated source code for local macros.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number.',
            },
            activate_on_update: {
                type: 'boolean',
                description: 'Activate parent class after updating. Default: false',
                default: false,
            },
        },
        required: ['class_name', 'macros_code'],
    },
};
async function handleUpdateLocalMacros(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, macros_code, transport_request, activate_on_update = false, } = args;
        if (!class_name || !macros_code) {
            return (0, utils_1.return_error)(new Error('class_name and macros_code are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Updating local macros for ${className}`);
        try {
            const localMacros = client.getLocalMacros();
            const updateResult = await localMacros.update({
                className,
                macrosCode: macros_code,
                transportRequest: transport_request,
            }, { activateOnUpdate: activate_on_update });
            if (!updateResult) {
                throw new Error(`Update did not return a result for ${className}`);
            }
            logger?.info(`✅ UpdateLocalMacros completed successfully: ${className}`);
            // Post-update class-level syntax check (see handleUpdateLocalDefinitions for rationale).
            let checkWarnings = [];
            try {
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'class', name: className });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Class', className);
                checkWarnings = checkResult.warnings;
                logger?.debug(`Post-update syntax check passed: ${className} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`);
            }
            catch (checkErr) {
                if (checkErr?.isPreCheckFailure) {
                    logger?.error(`Local macros of ${className} were updated but the class failed post-update syntax check: ${checkErr.message}`);
                    return (0, utils_1.return_error)(checkErr);
                }
                logger?.warn(`Post-update check had issues for ${className}: ${checkErr instanceof Error ? checkErr.message : String(checkErr)}`);
            }
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    transport_request: transport_request || null,
                    activated: activate_on_update,
                    message: `Local macros updated successfully in ${className}.`,
                    check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
                }, null, 2),
            });
        }
        catch (error) {
            if (error?.isPreCheckFailure) {
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating local macros for ${className}: ${error?.message || error}`);
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update local macros in ${className}`);
            let errorMessage = `Failed to update local macros: ${detailedError}`;
            if (error.response?.status === 404) {
                errorMessage = `Local macros for ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user.`;
            }
            return (0, utils_1.return_error)(new Error(errorMessage));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateLocalMacros.js.map