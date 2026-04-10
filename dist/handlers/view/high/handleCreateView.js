"use strict";
/**
 * CreateView Handler - CDS/Classic View Creation via ADT API
 *
 * Workflow: validate -> create (object in initial state)
 * DDL source is set via UpdateView handler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleCreateView = handleCreateView;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const transportValidation_js_1 = require("../../../utils/transportValidation.js");
exports.TOOL_DEFINITION = {
    name: 'CreateView',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: 'Create CDS View or Classic View in SAP. Creates the view object in initial state. Use UpdateView to set DDL source code afterwards.',
    inputSchema: {
        type: 'object',
        properties: {
            view_name: {
                type: 'string',
                description: 'View name (e.g., ZOK_R_TEST_0002, Z_I_MY_VIEW).',
            },
            package_name: {
                type: 'string',
                description: 'Package name (e.g., ZOK_LAB, $TMP for local objects)',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (required for transportable packages).',
            },
            description: {
                type: 'string',
                description: 'Optional description (defaults to view_name).',
            },
        },
        required: ['view_name', 'package_name'],
    },
};
async function handleCreateView(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args.view_name || !args.package_name) {
        return (0, utils_1.return_error)(new Error('Missing required parameters: view_name and package_name'));
    }
    try {
        (0, transportValidation_js_1.validateTransportRequest)(args.package_name, args.transport_request);
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
    const viewName = args.view_name.toUpperCase();
    logger?.info(`Starting view creation: ${viewName}`);
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        // Validate
        logger?.debug(`Validating view: ${viewName}`);
        await client.getView().validate({
            viewName,
            packageName: args.package_name,
            description: args.description || viewName,
        });
        logger?.debug(`View validation passed: ${viewName}`);
        // Create
        logger?.debug(`Creating view: ${viewName}`);
        await client.getView().create({
            viewName,
            description: args.description || viewName,
            packageName: args.package_name,
            ddlSource: '',
            transportRequest: args.transport_request,
        });
        logger?.info(`View created: ${viewName}`);
        const result = {
            success: true,
            view_name: viewName,
            package_name: args.package_name,
            transport_request: args.transport_request || null,
            type: 'DDLS',
            message: `View ${viewName} created successfully. Use UpdateView to set DDL source code.`,
            uri: `/sap/bc/adt/ddic/ddl/sources/${(0, utils_1.encodeSapObjectName)(viewName).toLowerCase()}`,
            steps_completed: ['validate', 'create'],
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
        logger?.error(`Error creating view ${viewName}: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleCreateView.js.map