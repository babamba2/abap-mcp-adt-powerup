"use strict";
/**
 * CreateBehaviorDefinition Handler - ABAP Behavior Definition Creation via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateBehaviorDefinition = handleCreateBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const preCheckBeforeActivation_1 = require("../../../lib/preCheckBeforeActivation");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateBehaviorDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP Behavior Definition (BDEF) in SAP system. Defines RAP business object behavior: CRUD operations, validations, determinations, actions, and draft handling.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Behavior Definition name (usually same as Root Entity name)',
            },
            description: {
                type: 'string',
                description: 'Description',
            },
            package_name: {
                type: 'string',
                description: 'Package name',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number',
            },
            root_entity: {
                type: 'string',
                description: 'Root Entity name (CDS View name)',
            },
            implementation_type: {
                type: 'string',
                description: "Implementation type: 'Managed', 'Unmanaged', 'Abstract', 'Projection'",
                enum: ['Managed', 'Unmanaged', 'Abstract', 'Projection'],
            },
            activate: {
                type: 'boolean',
                description: 'Activate after creation. Default: true',
            },
        },
        required: ['name', 'package_name', 'root_entity', 'implementation_type'],
    },
};
async function handleCreateBehaviorDefinition(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.name ||
        !args.package_name ||
        !args.root_entity ||
        !args.implementation_type) {
        return (0, utils_1.return_error)(new Error('Missing required parameters'));
    }
    try {
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
    const name = args.name.toUpperCase();
    // Get connection from session context (set by ProtocolHandler)
    // Connection is managed and cached per session, with proper token refresh via AuthBroker
    logger?.info(`Starting BDEF creation: ${name}`);
    try {
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const shouldActivate = args.activate !== false;
        // Create - using types from adt-clients
        const createConfig = {
            name,
            description: args.description || name,
            packageName: args.package_name,
            transportRequest: args.transport_request || '',
            rootEntity: args.root_entity,
            implementationType: args.implementation_type,
        };
        await client.getBehaviorDefinition().create(createConfig);
        // Lock - using types from adt-clients
        const lockConfig = { name };
        const lockHandle = await client.getBehaviorDefinition().lock(lockConfig);
        try {
            // Post-create syntax check on the staged inactive version.
            // Surfaces ALL compile errors with structured diagnostics.
            const checkResult = await (0, preCheckBeforeActivation_1.runSyntaxCheck)({ connection, logger }, { kind: 'behaviorDefinition', name });
            (0, preCheckBeforeActivation_1.assertNoCheckErrors)(checkResult, 'Behavior Definition', name);
            // Unlock - using types from adt-clients
            const unlockConfig = {
                name,
            };
            await client.getBehaviorDefinition().unlock(unlockConfig, lockHandle);
            // Activate if requested - using types from adt-clients
            if (shouldActivate) {
                const activateConfig = {
                    name,
                };
                await client.getBehaviorDefinition().activate(activateConfig);
            }
        }
        catch (error) {
            // Unlock on error (principle 1: if lock was done, unlock is mandatory)
            try {
                const unlockConfig = {
                    name,
                };
                await client.getBehaviorDefinition().unlock(unlockConfig, lockHandle);
            }
            catch (unlockError) {
                logger?.error(`Failed to unlock behavior definition after error: ${unlockError instanceof Error ? unlockError.message : String(unlockError)}`);
            }
            // Principle 2: first error and exit
            throw error;
        }
        const result = {
            success: true,
            name: name,
            package_name: args.package_name,
            type: 'BDEF',
            message: shouldActivate
                ? `Behavior Definition ${name} created and activated successfully`
                : `Behavior Definition ${name} created successfully`,
        };
        logger?.info(`✅ CreateBehaviorDefinition completed successfully: ${name}`);
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        // PreCheck syntax-check failures carry full structured diagnostics —
        // forward them as-is so the caller sees every error with line numbers.
        if (error?.isPreCheckFailure) {
            logger?.error(`Error creating BDEF ${name}: ${error.message}`);
            return (0, utils_1.return_error)(error);
        }
        logger?.error(`Error creating BDEF ${name}: ${error?.message || error}`);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateBehaviorDefinition.js.map