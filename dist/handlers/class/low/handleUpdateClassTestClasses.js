"use strict";
/**
 * UpdateClassTestClasses Handler - Update ABAP Unit test include for a class
 *
 * Uses AdtClient.updateClassTestIncludes from @mcp-abap-adt/adt-clients.
 * Low-level handler: single method call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateClassTestClasses = handleUpdateClassTestClasses;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateClassTestClassesLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Upload ABAP Unit test include source code for an existing class. Requires test_classes_lock_handle from LockClassTestClassesLow.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'Class name (e.g., ZCL_MY_CLASS).',
            },
            test_class_source: {
                type: 'string',
                description: 'Complete ABAP Unit test class source code.',
            },
            lock_handle: {
                type: 'string',
                description: 'Test classes lock handle from LockClassTestClassesLow.',
            },
            skip_check: {
                type: 'boolean',
                description: 'Skip post-write syntax check. Default: false. When false, runs a syntax check on the parent class after updating the test-classes include and surfaces any errors with line numbers.',
            },
            session_id: {
                type: 'string',
                description: 'Session ID from GetSession. If not provided, a new session will be created.',
            },
            session_state: {
                type: 'object',
                description: 'Session state from GetSession (cookies, csrf_token, cookie_store). Required if session_id is provided.',
                properties: {
                    cookies: { type: 'string' },
                    csrf_token: { type: 'string' },
                    cookie_store: { type: 'object' },
                },
            },
        },
        required: ['class_name', 'test_class_source', 'lock_handle'],
    },
};
async function handleUpdateClassTestClasses(context, args) {
    const { connection, logger } = context;
    try {
        const { class_name, test_class_source, lock_handle, skip_check, session_id, session_state, } = args;
        if (!class_name || !test_class_source || !lock_handle) {
            return (0, utils_1.return_error)(new Error('class_name, test_class_source, and lock_handle are required'));
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        if (session_id && session_state) {
            await (0, utils_1.restoreSessionInConnection)(connection, session_id, session_state);
        }
        else {
        }
        const className = class_name.toUpperCase();
        logger?.info(`Starting test classes update for: ${className}`);
        try {
            const updateState = await client.getLocalTestClass().update({
                className,
                testClassCode: test_class_source,
            }, { lockHandle: lock_handle });
            const updateResult = updateState.updateResult;
            // Post-write syntax check on the parent class (unless skipped).
            // Surfaces ALL compile errors with line numbers — catches bad
            // test-class code via a class-level /checkruns compile.
            if (skip_check !== true) {
                const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'class', name: className });
                (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Class', className);
            }
            logger?.info(`✅ UpdateClassTestClasses completed: ${className}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    class_name: className,
                    session_id: session_id || null,
                    status: updateResult?.status,
                    session_state: null, // Session state management is now handled by auth-broker,
                    message: `Test classes for ${className} updated successfully. Remember to unlock using UnlockClassTestClassesLow.`,
                }, null, 2),
            });
        }
        catch (error) {
            // PreCheck syntax-check failures carry full structured diagnostics —
            // forward them as-is so the caller sees every error with line numbers.
            if (error?.isPreCheckFailure) {
                logger?.error(`Error updating test classes for ${className}: ${error.message}`);
                return (0, utils_1.return_error)(error);
            }
            const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update test classes for ${className}`);
            logger?.error(`Error updating test classes for ${className}: ${detailedError}`);
            const reason = error?.response?.status === 404
                ? `Class ${className} not found.`
                : error?.response?.status === 423
                    ? `Test classes for ${className} are locked by another user or lock handle is invalid.`
                    : detailedError;
            return (0, utils_1.return_error)(new Error(reason));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleUpdateClassTestClasses.js.map