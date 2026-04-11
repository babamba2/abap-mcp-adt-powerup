"use strict";
/**
 * CreateProgram Handler - ABAP Program Creation via ADT API
 *
 * Workflow: validate -> create (object in initial state)
 * Source code is set via UpdateProgram handler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateProgram = handleCreateProgram;
const clients_1 = require("../../../lib/clients");
const preflightCheck_1 = require("../../../lib/preflightCheck");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateProgram',
    available_in: ['onprem', 'legacy'],
    description: 'Create a new ABAP program (report) in SAP system. Creates the program object in initial state. Use UpdateProgram to set source code afterwards.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_TEST_PROGRAM_001). Must follow SAP naming conventions (start with Z or Y).',
            },
            description: {
                type: 'string',
                description: 'Program description. If not provided, program_name will be used.',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LAB, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            program_type: {
                type: 'string',
                description: "Program type: 'executable' (Report), 'include', 'module_pool', 'function_group', 'class_pool', 'interface_pool'. Default: 'executable'",
                enum: [
                    'executable',
                    'include',
                    'module_pool',
                    'function_group',
                    'class_pool',
                    'interface_pool',
                ],
            },
            application: {
                type: 'string',
                description: "Application area (e.g., 'S' for System, 'M' for Materials Management). Default: '*'",
            },
        },
        required: ['program_name', 'package_name'],
    },
};
async function handleCreateProgram(context, params) {
    const { connection, logger } = context;
    const args = params;
    // Validate required parameters
    if (!args.program_name || !args.package_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: program_name and package_name'));
    }
    // Check if cloud - programs are not available on cloud systems
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.'));
    }
    // Validate transport_request: required for non-$TMP packages
    try {
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
    const programName = args.program_name.toUpperCase();
    logger?.info(`Starting program creation: ${programName}`);
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        // Validate
        logger?.debug(`Validating program: ${programName}`);
        const validationState = await client.getProgram().validate({
            programName,
            description: args.description || programName,
            packageName: args.package_name,
        });
        const validationResponse = validationState.validationResponse;
        if (!validationResponse) {
            throw new Error('Validation did not return a result');
        }
        const validationResult = (0, utils_1.parseValidationResponse)(validationResponse);
        if (!validationResult || validationResult.valid === false) {
            throw new Error(`Program name validation failed: ${validationResult?.message || 'Invalid program name'}`);
        }
        logger?.debug(`Program validation passed: ${programName}`);
        // Create
        logger?.debug(`Creating program: ${programName}`);
        await client.getProgram().create({
            programName,
            description: args.description || programName,
            packageName: args.package_name,
            transportRequest: args.transport_request,
            programType: args.program_type,
            application: args.application,
        });
        logger?.info(`Program created: ${programName}`);
        // Post-create sanity syntax check. The shell the ADT create endpoint
        // produces is a minimal REPORT statement that should always be
        // clean, but the check also verifies the package / transport /
        // naming side of things once the object is actually in the system.
        // Non-fatal: if the check endpoint fails for transport reasons, log
        // a warning and still return success.
        const stepsCompleted = ['validate', 'create'];
        let checkWarnings = [];
        try {
            logger?.debug(`Post-create syntax check: ${programName}`);
            const checkResult = await (0, preflightCheck_1.runSyntaxCheck)({ connection, logger }, { kind: 'program', name: programName });
            (0, preflightCheck_1.assertNoCheckErrors)(checkResult, 'Program', programName);
            checkWarnings = checkResult.warnings;
            stepsCompleted.push('check');
            logger?.debug(`Post-create syntax check passed: ${programName} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`);
        }
        catch (checkErr) {
            if (checkErr?.isPreflightCheckFailure) {
                logger?.error(`Program ${programName} was created but failed post-create syntax check: ${checkErr.message}`);
                return (0, utils_1.return_error)(checkErr);
            }
            logger?.warn(`Post-create check had issues for ${programName}: ${checkErr instanceof Error ? checkErr.message : String(checkErr)}`);
        }
        const result = {
            success: true,
            program_name: programName,
            package_name: args.package_name,
            transport_request: args.transport_request || null,
            program_type: args.program_type || 'executable',
            type: 'PROG/P',
            message: `Program ${programName} created successfully. Use UpdateProgram to set source code.`,
            uri: `/sap/bc/adt/programs/programs/${(0, utils_1.encodeSapObjectName)(programName).toLowerCase()}`,
            steps_completed: stepsCompleted,
            check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`Error creating program ${programName}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`Failed to create program ${programName}: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleCreateProgram.js.map