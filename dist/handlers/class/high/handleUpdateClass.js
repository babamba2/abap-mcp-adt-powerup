"use strict";
/**
 * UpdateClass Handler - Update existing ABAP class source code (optional activation)
 *
 * Workflow: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive) -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateClass = handleUpdateClass;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateClass',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Update source code of an existing ABAP class. Locks, checks, updates, unlocks, and optionally activates.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_TEST_CLASS_001).',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP class source code.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: false.',
            },
        },
        required: ['class_name', 'source_code'],
    },
};
async function handleUpdateClass(context, params) {
    const args = params;
    const { connection, logger } = context;
    if (!args.class_name || !args.source_code) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: class_name and source_code'));
    }
    const className = args.class_name.toUpperCase();
    logger?.info(`Starting UpdateClass for ${className} (activate=${args.activate === true})`);
    try {
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const shouldActivate = args.activate === true;
        let lockHandle;
        let checkWarnings = [];
        try {
            // Lock
            logger?.debug(`Locking class: ${className}`);
            lockHandle = await client.getClass().lock({ className: className });
            logger?.debug(`Class locked: ${className} (handle=${lockHandle ? `${lockHandle.substring(0, 8)}...` : 'none'})`);
            // Pre-write syntax check on the proposed source. If errors are
            // found we never PUT the broken code; the active class stays in
            // its previous working state. The lock is released by the finally
            // block below.
            logger?.debug(`Pre-write syntax check: ${className}`);
            const preCheckResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, {
                kind: 'class',
                name: className,
                sourceCode: args.source_code,
            });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(preCheckResult, 'Class', className);
            checkWarnings = preCheckResult.warnings;
            logger?.debug(`Pre-write check passed: ${className}`);
            // Update
            logger?.debug(`Updating class source code: ${className}`);
            await client.getClass().update({
                className: className,
                sourceCode: args.source_code,
                transportRequest: args.transport_request,
            }, { lockHandle });
            logger?.info(`Class source code updated: ${className}`);
        }
        finally {
            if (lockHandle) {
                try {
                    logger?.debug(`Unlocking class: ${className}`);
                    await client.getClass().unlock({ className: className }, lockHandle);
                    logger?.info(`Class unlocked: ${className}`);
                }
                catch (unlockError) {
                    logger?.warn(`Failed to unlock class ${className}: ${unlockError?.message || unlockError}`);
                }
            }
        }
        // Post-write inactive check — non-fatal: warnings flow into
        // check_warnings, transport/tooling issues are logged and ignored.
        logger?.debug(`Checking inactive version: ${className}`);
        try {
            const postCheckResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'class', name: className });
            if (postCheckResult.warnings.length > 0) {
                checkWarnings = [...checkWarnings, ...postCheckResult.warnings];
            }
            logger?.debug(`Inactive version check completed: ${className}`);
        }
        catch (checkError) {
            logger?.warn(`Inactive version check had issues: ${className} - ${checkError instanceof Error ? checkError.message : String(checkError)}`);
        }
        // Activate if requested
        if (shouldActivate) {
            logger?.debug(`Activating class: ${className}`);
            await client.getClass().activate({ className: className });
            logger?.info(`Class activated: ${className}`);
        }
        else {
            logger?.debug(`Skipping activation for: ${className}`);
        }
        logger?.info(`UpdateClass completed successfully: ${className}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                class_name: className,
                activated: shouldActivate,
                message: `Class ${className} updated${shouldActivate ? ' and activated' : ''} successfully`,
                check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
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
        // Parse error message
        let errorMessage = error instanceof Error ? error.message : String(error);
        // Attempt to parse ADT XML error
        try {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
            });
            const errorData = error?.response?.data
                ? parser.parse(error.response.data)
                : null;
            const errorMsg = errorData?.['exc:exception']?.message?.['#text'] ||
                errorData?.['exc:exception']?.message;
            if (errorMsg) {
                errorMessage = `SAP Error: ${errorMsg}`;
            }
        }
        catch {
            // ignore parse errors
        }
        logger?.error(`Unexpected error in UpdateClass handler: ${className} - ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleUpdateClass.js.map