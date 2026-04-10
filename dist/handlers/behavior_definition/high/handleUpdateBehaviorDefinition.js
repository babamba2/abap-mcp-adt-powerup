"use strict";
/**
 * UpdateBehaviorDefinition Handler - ABAP Behavior Definition Update via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateBehaviorDefinition = handleUpdateBehaviorDefinition;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateBehaviorDefinition',
    available_in: ['onprem', 'cloud'],
    description: 'Update source code of an ABAP Behavior Definition (BDEF). Modifies RAP business object behavior: CRUD operations, validations, determinations, actions, and draft handling.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Behavior Definition name',
            },
            source_code: {
                type: 'string',
                description: 'New source code',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635). Required for transportable packages.',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. If not provided, will attempt to lock internally (not recommended for stateful flows).',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: true',
            },
        },
        required: ['name', 'source_code'],
    },
};
async function handleUpdateBehaviorDefinition(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.name || !args.source_code) {
        return (0, utils_1.return_error)(new Error('Missing required parameters'));
    }
    const name = args.name.toUpperCase();
    // Get connection from session context (set by ProtocolHandler)
    // Connection is managed and cached per session, with proper token refresh via AuthBroker
    logger?.info(`Starting BDEF update: ${name}`);
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const shouldActivate = args.activate !== false;
        let lockHandle = args.lock_handle;
        // Lock if not provided - using types from adt-clients
        if (!lockHandle) {
            const lockConfig = {
                name,
            };
            lockHandle = await client.getBehaviorDefinition().lock(lockConfig);
        }
        // Update - using types from adt-clients
        const updateConfig = {
            name,
            sourceCode: args.source_code,
            transportRequest: args.transport_request,
        };
        await client
            .getBehaviorDefinition()
            .update(updateConfig, { lockHandle: lockHandle });
        // Unlock if we locked it internally - using types from adt-clients
        if (!args.lock_handle) {
            const unlockConfig = {
                name,
            };
            await client.getBehaviorDefinition().unlock(unlockConfig, lockHandle);
        }
        // Activate if requested - using types from adt-clients
        if (shouldActivate) {
            const activateConfig = {
                name,
            };
            await client.getBehaviorDefinition().activate(activateConfig);
        }
        const result = {
            success: true,
            name: name,
            message: shouldActivate
                ? `Behavior Definition ${name} updated and activated successfully`
                : `Behavior Definition ${name} updated successfully`,
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
        const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update behavior definition ${name}`);
        logger?.error(`Error updating BDEF ${name}: ${detailedError}`);
        return (0, utils_1.return_error)(new Error(detailedError));
    }
}
//# sourceMappingURL=handleUpdateBehaviorDefinition.js.map