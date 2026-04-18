"use strict";
/**
 * UpdateClass Handler - Update ABAP Class Source Code
 *
 * Uses AdtClient.updateClass from @babamba2/mcp-abap-adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateClass = handleUpdateClass;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateClassLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Update source code of an existing ABAP class. Uses session from HandlerContext. Requires lock handle from LockClass operation. - use UpdateClass (high-level) for full workflow with lock/unlock/activate.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_TEST_CLASS_001). Class must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP class source code including CLASS DEFINITION and IMPLEMENTATION sections.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockClass operation. Required for update operation.',
            },
            skip_check: {
                type: 'boolean',
                description: 'Skip pre-write syntax check on source_code. Default: false. When false, runs a syntax check on the proposed code BEFORE uploading it and surfaces any errors with line numbers — the broken source never lands on SAP.',
            },
        },
        required: ['class_name', 'source_code', 'lock_handle'],
    },
};
/**
 * Main handler for UpdateClass MCP tool
 *
 * Uses AdtClient.updateClass - low-level single method call
 */
async function handleUpdateClass(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, source_code, lock_handle, skip_check } = args;
        // Validation
        if (!class_name || !source_code || !lock_handle) {
            return (0, utils_1.return_error)(new Error('class_name, source_code, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const className = class_name.toUpperCase();
        logger?.info(`Starting class update: ${className}`);
        try {
            // Pre-write syntax check on the proposed source (unless skipped).
            // Surfaces ALL compile errors with line numbers via the raw
            // /checkruns inline-artifact path, so the broken source never
            // lands on SAP.
            if (skip_check !== true) {
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'class', name: className, sourceCode: source_code });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Class', className);
            }
            // Update class with source code
            const updateState = await client
                .getClass()
                .update({ className, sourceCode: source_code }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            if (!updateResult) {
                throw new Error(`Update did not return a response for class ${className}`);
            }
            logger?.info(`✅ UpdateClass completed: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    message: `Class ${className} updated successfully. Remember to unlock using UnlockClassLow.`,
                }, null, 2),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating class ${className}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            logger?.error(`Error updating class ${className}: ${error?.message || error}`);
            // Parse error message
            let errorMessage = `Failed to update class: ${error.message || String(error)}`;
            if (error.response?.status === 404) {
                errorMessage = `Class ${className} not found.`;
            }
            else if (error.response?.status === 423) {
                errorMessage = `Class ${className} is locked by another user or lock handle is invalid.`;
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
//# sourceMappingURL=handleUpdateClass.js.map