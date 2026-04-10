"use strict";
/**
 * GetInactiveObjects Handler - Retrieve list of inactive ABAP objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetInactiveObjects = handleGetInactiveObjects;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetInactiveObjects',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Get a list of inactive ABAP objects — modified but not yet activated, pending activation. Shows classes, tables, CDS views, and other objects awaiting activation.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
async function handleGetInactiveObjects(context, _params) {
    const { connection, logger } = context;
    try {
        const client = (0, clients_1.createAdtClient)(connection);
        const utils = client.getUtils();
        logger?.info('Retrieving inactive objects...');
        const result = await utils.getInactiveObjects();
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                count: result.objects.length,
                objects: result.objects,
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        logger?.error('Error retrieving inactive objects:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetInactiveObjects.js.map