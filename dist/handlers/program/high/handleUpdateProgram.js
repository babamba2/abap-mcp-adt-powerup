"use strict";
/**
 * UpdateProgram Handler - Update Existing ABAP Program Source Code
 *
 * Workflow: lock -> check (new code) -> update (if check OK) -> unlock -> check (inactive) -> (activate)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateProgram = handleUpdateProgram;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const preflightCheck_1 = require("../../../lib/preflightCheck");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateProgram',
    available_in: ['onprem', 'legacy'],
    description: 'Update source code of an existing ABAP program. Locks the program, checks new code, uploads new source code, and unlocks. Optionally activates after update. Use this to modify existing programs without re-creating metadata.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_TEST_PROGRAM_001). Program must already exist.',
            },
            source_code: {
                type: 'string',
                description: 'Complete ABAP program source code.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            activate: {
                type: 'boolean',
                description: 'Activate program after source update. Default: false. Set to true to activate immediately, or use ActivateObject for batch activation.',
            },
        },
        required: ['program_name', 'source_code'],
    },
};
async function handleUpdateProgram(context, params) {
    const { connection, logger } = context;
    const args = params;
    // Validate required parameters
    if (!args.program_name || !args.source_code) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and source_code'));
    }
    // Check if cloud - programs are not available on cloud systems
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
    }
    const programName = args.program_name.toUpperCase();
    logger?.info(`Starting program source update: ${programName} (activate=${args.activate === true})`);
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const shouldActivate = args.activate === true; // Default to false if not specified
        let lockHandle;
        let activateResponse;
        let checkWarnings = [];
        try {
            // Lock
            logger?.debug(`Locking program: ${programName}`);
            lockHandle = await client.getProgram().lock({ programName });
            logger?.debug(`Program locked: ${programName} (handle=${lockHandle ? `${lockHandle.substring(0, 8)}...` : 'none'})`);
            // Preflight syntax check on the new source BEFORE upload.
            // If this throws, we never PUT the broken code, so the program
            // stays in its previous working state.
            logger?.debug(`Checking new source code before update: ${programName}`);
            const preCheckResult = await (0, preflightCheck_1.runSyntaxCheck)({ connection, logger }, {
                kind: 'program',
                name: programName,
                sourceCode: args.source_code,
            });
            (0, preflightCheck_1.assertNoCheckErrors)(preCheckResult, 'Program', programName);
            checkWarnings = preCheckResult.warnings;
            logger?.debug(`New code check passed: ${programName}`);
            // Update
            logger?.debug(`Updating program source code: ${programName}`);
            await client.getProgram().update({
                programName,
                sourceCode: args.source_code,
                transportRequest: args.transport_request,
            }, { lockHandle });
            logger?.info(`Program source code updated: ${programName}`);
        }
        finally {
            if (lockHandle) {
                try {
                    logger?.debug(`Unlocking program: ${programName}`);
                    await client.getProgram().unlock({ programName }, lockHandle);
                    logger?.info(`Program unlocked: ${programName}`);
                }
                catch (unlockError) {
                    logger?.warn(`Failed to unlock program ${programName}: ${unlockError?.message || unlockError}`);
                }
            }
        }
        // Check inactive version (after unlock) — non-fatal: warnings from
        // the post-write view go into check_warnings in the response, but
        // transport/tooling issues on this pass don't abort the flow.
        logger?.debug(`Checking inactive version: ${programName}`);
        try {
            const postCheckResult = await (0, preflightCheck_1.runSyntaxCheck)({ connection, logger }, { kind: 'program', name: programName });
            if (postCheckResult.warnings.length > 0) {
                checkWarnings = [...checkWarnings, ...postCheckResult.warnings];
            }
            logger?.debug(`Inactive version check completed: ${programName}`);
        }
        catch (checkError) {
            logger?.warn(`Inactive version check had issues: ${programName} - ${checkError instanceof Error ? checkError.message : String(checkError)}`);
        }
        // Activate if requested
        if (shouldActivate) {
            logger?.debug(`Activating program: ${programName}`);
            try {
                const activateState = await client.getProgram().activate({
                    programName,
                });
                activateResponse = activateState.activateResult;
                logger?.info(`Program activated: ${programName}`);
            }
            catch (activationError) {
                logger?.error(`Activation failed: ${programName} - ${activationError instanceof Error ? activationError.message : String(activationError)}`);
                throw new Error(`Activation failed: ${activationError instanceof Error ? activationError.message : String(activationError)}`);
            }
        }
        else {
            logger?.debug(`Skipping activation for: ${programName}`);
        }
        // Parse activation warnings if activation was performed
        let activationWarnings = [];
        if (shouldActivate &&
            activateResponse &&
            typeof activateResponse.data === 'string' &&
            activateResponse.data.includes('<chkl:messages')) {
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
            });
            const result = parser.parse(activateResponse.data);
            const messages = result?.['chkl:messages']?.msg;
            if (messages) {
                const msgArray = Array.isArray(messages) ? messages : [messages];
                activationWarnings = msgArray.map((msg) => `${msg['@_type']}: ${msg.shortText?.txt || 'Unknown'}`);
            }
        }
        logger?.info(`UpdateProgram completed successfully: ${programName}`);
        const result = {
            success: true,
            program_name: programName,
            type: 'PROG/P',
            activated: shouldActivate,
            message: shouldActivate
                ? `Program ${programName} source updated and activated successfully`
                : `Program ${programName} source updated successfully (not activated)`,
            uri: `/sap/bc/adt/programs/programs/${(0, utils_1.encodeSapObjectName)(programName).toLowerCase()}`,
            steps_completed: [
                'lock',
                'check_new_code',
                'update',
                'unlock',
                'check_inactive',
                ...(shouldActivate ? ['activate'] : []),
            ],
            activation_warnings: activationWarnings.length > 0 ? activationWarnings : undefined,
            check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
            source_size_bytes: args.source_code.length,
        };
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        // Preflight syntax-check failures carry full structured diagnostics —
        // surface as-is so the caller sees every error with line numbers.
        if (error?.isPreflightCheckFailure) {
            logger?.error(`Error updating program source ${programName}: ${error.message}`);
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
        logger?.error(`Error updating program source ${programName}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to update program ${programName}: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleUpdateProgram.js.map