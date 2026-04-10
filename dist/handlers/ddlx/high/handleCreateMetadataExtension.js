"use strict";
/**
 * CreateMetadataExtension Handler - ABAP Metadata Extension Creation via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateMetadataExtension = handleCreateMetadataExtension;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateMetadataExtension',
    available_in: ['onprem', 'cloud'],
    description: 'Create a new ABAP Metadata Extension (DDLX) in SAP system. Defines Fiori UI annotations, field labels, search help, and list/object page layout for CDS views.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Metadata Extension name',
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
            activate: {
                type: 'boolean',
                description: 'Activate after creation. Default: true',
            },
        },
        required: ['name', 'package_name'],
    },
};
async function handleCreateMetadataExtension(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.name || !args.package_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameters'));
    }
    try {
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
    const name = args.name.toUpperCase();
    logger?.info(`Starting DDLX creation: ${name}`);
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const shouldActivate = args.activate !== false;
        // Create
        await client.getMetadataExtension().create({
            name,
            description: args.description || name,
            packageName: args.package_name,
            transportRequest: args.transport_request || '',
        });
        // Lock
        const lockHandle = await client.getMetadataExtension().lock({ name: name });
        try {
            // Check
            await client.getMetadataExtension().check({ name: name });
            // Unlock
            await client.getMetadataExtension().unlock({ name: name }, lockHandle);
            // Activate if requested
            if (shouldActivate) {
                await client.getMetadataExtension().activate({ name: name });
            }
        }
        catch (error) {
            // Unlock on error (principle 1: if lock was done, unlock is mandatory)
            try {
                await client.getMetadataExtension().unlock({ name: name }, lockHandle);
            }
            catch (unlockError) {
                logger?.error(`Failed to unlock metadata extension after error: ${unlockError instanceof Error ? unlockError.message : String(unlockError)}`);
            }
            // Principle 2: first error and exit
            throw error;
        }
        const result = {
            success: true,
            name: name,
            package_name: args.package_name,
            type: 'DDLX',
            message: shouldActivate
                ? `Metadata Extension ${name} created and activated successfully`
                : `Metadata Extension ${name} created successfully`,
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
        logger?.error(`Error creating DDLX ${name}: ${error?.message || error}`);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleCreateMetadataExtension.js.map