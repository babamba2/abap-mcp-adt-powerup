"use strict";
/**
 * ActivateObject Handler - Universal ABAP Object Activation via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateObject = handleActivateObject;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ActivateObjectLow',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[low-level] Activate one or multiple ABAP repository objects. Works with any object type; URI is auto-generated from name and type.',
    inputSchema: {
        type: 'object',
        properties: {
            objects: {
                type: 'array',
                description: "Array of objects to activate. Each object must have 'name' and 'type'. URI is optional.",
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Object name in uppercase' },
                        type: {
                            type: 'string',
                            description: "Object type code (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF')",
                        },
                        uri: { type: 'string', description: 'Optional ADT URI' },
                    },
                    required: ['name', 'type'],
                },
            },
            preaudit: {
                type: 'boolean',
                description: 'Request pre-audit before activation. Default: true',
            },
        },
        required: ['objects'],
    },
};
async function handleActivateObject(context, params) {
    const { connection, logger } = context;
    try {
        const args = params;
        if (!args.objects ||
            !Array.isArray(args.objects) ||
            args.objects.length === 0) {
            return (0, utils_1.return_error)(new Error('Missing required parameter: objects (must be non-empty array)'));
        }
        const preaudit = args.preaudit !== false; // default true
        const client = (0, clients_1.createAdtClient)(connection, logger);
        logger?.info(`Starting activation of ${args.objects.length} object(s)`);
        try {
            const activationObjects = args.objects.map((obj) => ({
                type: obj.type,
                name: obj.name.toUpperCase(),
            }));
            logger?.debug(`Activating objects: ${activationObjects.map((o) => o.name).join(', ')}`);
            const response = await client
                .getUtils()
                .activateObjectsGroup(activationObjects, preaudit);
            logger?.debug(`Activation response status: ${response.status}`);
            const activationResult = (0, utils_1.parseActivationResponse)(response.data);
            const success = activationResult.activated && activationResult.checked;
            const result = {
                success,
                objects_count: args.objects.length,
                objects: activationObjects.map((obj, idx) => ({
                    name: obj.name,
                    uri: args.objects[idx].uri,
                    type: args.objects[idx].type,
                })),
                activation: {
                    activated: activationResult.activated,
                    checked: activationResult.checked,
                    generated: activationResult.generated,
                },
                messages: activationResult.messages,
                warnings: activationResult.messages.filter((m) => m.type === 'warning' || m.type === 'W'),
                errors: activationResult.messages.filter((m) => m.type === 'error' || m.type === 'E'),
                message: success
                    ? `Successfully activated ${args.objects.length} object(s)`
                    : `Activation completed with ${activationResult.messages.length} message(s)`,
            };
            logger?.info(`Activation completed: ${success ? 'SUCCESS' : 'WITH ISSUES'}`);
            return (0, utils_1.return_response)({
                data: JSON.stringify(result, null, 2),
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            });
        }
        catch (error) {
            logger?.error('Error during activation', error);
            let errorMessage;
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    errorMessage = error.response.data;
                }
                else {
                    try {
                        errorMessage = JSON.stringify(error.response.data);
                    }
                    catch {
                        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText || 'Error'}`;
                    }
                }
            }
            else {
                errorMessage = error.message || String(error);
            }
            return (0, utils_1.return_error)(new Error(`Failed to activate objects: ${errorMessage}`));
        }
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleActivateObject.js.map