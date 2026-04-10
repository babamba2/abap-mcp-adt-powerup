"use strict";
/**
 * UpdateMetadataExtension Handler - ABAP Metadata Extension Update via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleUpdateMetadataExtension = handleUpdateMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'UpdateMetadataExtension',
    available_in: ['onprem', 'cloud'],
    description: 'Update source code of an ABAP Metadata Extension (DDLX). Modifies Fiori UI annotations, field labels, search help, and list/object page layout for CDS views.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Metadata Extension name',
            },
            source_code: {
                type: 'string',
                description: 'New source code',
            },
            lock_handle: {
                type: 'string',
                description: 'Lock handle from LockObject. If not provided, will attempt to lock internally.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
            },
            activate: {
                type: 'boolean',
                description: 'Activate after update. Default: true',
            },
        },
        required: ['name', 'source_code'],
    },
};
async function handleUpdateMetadataExtension(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.name || !args.source_code) {
        return (0, utils_1.return_error)(new Error('Missing required parameters'));
    }
    const name = args.name.toUpperCase();
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const shouldActivate = args.activate !== false;
        let lockHandle = args.lock_handle;
        // Lock if not provided
        if (!lockHandle) {
            lockHandle = await client.getMetadataExtension().lock({ name: name });
        }
        // Update
        await client.getMetadataExtension().update({
            name,
            sourceCode: args.source_code,
            transportRequest: args.transport_request,
        }, { lockHandle });
        // Unlock if we locked it internally
        if (!args.lock_handle) {
            await client.getMetadataExtension().unlock({ name: name }, lockHandle);
        }
        // Activate if requested
        if (shouldActivate) {
            await client.getMetadataExtension().activate({ name: name });
        }
        const result = {
            success: true,
            name: name,
            message: shouldActivate
                ? `Metadata Extension ${name} updated and activated successfully`
                : `Metadata Extension ${name} updated successfully`,
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
        const detailedError = (0, utils_1.extractAdtErrorMessage)(error, `Failed to update metadata extension ${name}`);
        logger?.error(`Error updating DDLX ${name}: ${detailedError}`);
        return (0, utils_1.return_error)(new Error(detailedError));
    }
}
//# sourceMappingURL=handleUpdateMetadataExtension.js.map