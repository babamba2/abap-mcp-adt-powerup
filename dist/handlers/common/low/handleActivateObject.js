"use strict";
/**
 * ActivateObject Handler - Universal ABAP Object Activation via ADT API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleActivateObject = handleActivateObject;
const localGroupActivation_1 = require("../../../lib/localGroupActivation");
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
        logger?.info(`Starting activation of ${args.objects.length} object(s)`);
        try {
            // Route through the local mass-activation helper so an explicit
            // `uri` on the input object is honored (upstream adt-clients
            // v3.10.2 drops it) and so types like PROG/I resolve correctly.
            const inputs = args.objects.map((obj) => ({
                name: obj.name,
                type: obj.type,
                uri: obj.uri,
            }));
            logger?.debug(`Activating objects: ${inputs.map((o) => o.name).join(', ')}`);
            const grp = await (0, localGroupActivation_1.activateObjectsLocal)(connection, inputs, {
                preauditRequested: preaudit,
            });
            const result = {
                success: grp.success,
                objects_count: grp.objects.length,
                endpoint: grp.endpoint,
                run_id: grp.run_id,
                objects: grp.objects.map((o) => ({
                    name: o.name,
                    uri: o.uri,
                    type: o.type,
                    status: o.status,
                })),
                activation: {
                    activated: grp.activated,
                    checked: grp.checked,
                    generated: grp.generated,
                },
                messages: [...grp.errors, ...grp.warnings],
                warnings: grp.warnings,
                errors: grp.errors,
                message: grp.success
                    ? `Successfully activated ${grp.objects.length} object(s)`
                    : `Activation completed with ${grp.errors.length} error(s) and ${grp.warnings.length} warning(s)`,
            };
            logger?.info(`Activation completed: ${grp.success ? 'SUCCESS' : 'WITH ISSUES'}`);
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