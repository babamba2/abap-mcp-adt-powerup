"use strict";
/**
 * ListTransports Handler - List user's transport requests via ADT API
 *
 * Retrieves transport requests for the current user or specified user.
 * Uses AdtClient.getRequest().list() with proper Accept negotiation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleListTransports = handleListTransports;
const fast_xml_parser_1 = require("fast-xml-parser");
const clients_1 = require("../../../lib/clients");
const systemContext_1 = require("../../../lib/systemContext");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ListTransports',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] List transport requests for the current or specified user. Returns modifiable and/or released workbench and customizing requests.',
    inputSchema: {
        type: 'object',
        properties: {
            user: {
                type: 'string',
                description: 'SAP user name. If not provided, returns transports for the current user.',
            },
            modifiable_only: {
                type: 'boolean',
                description: 'Only return modifiable (not yet released) transports. Default: true.',
            },
        },
        required: [],
    },
};
function parseTransportListXml(xmlData) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        isArray: (name) => {
            return ['tm:request', 'tm:task'].includes(name);
        },
    });
    const result = parser.parse(xmlData);
    // Response can be under different roots depending on SAP version
    const root = result['tm:root'] || result['tm:roots'] || result;
    // Extract requests
    const requests = root?.['tm:request'] || root?.['tm:workbench']?.['tm:request'] || [];
    const requestList = Array.isArray(requests) ? requests : [requests];
    return requestList
        .filter((req) => req)
        .map((req) => ({
        number: req['tm:number'] || req['adtcore:name'] || '',
        description: req['tm:desc'] || req['tm:description'] || '',
        type: req['tm:type'] || '',
        status: req['tm:status'] || '',
        owner: req['tm:owner'] || '',
        target: req['tm:target'] || '',
    }))
        .filter((t) => t.number);
}
async function handleListTransports(context, args) {
    const { connection, logger } = context;
    try {
        const modifiableOnly = args?.modifiable_only !== false;
        const user = args?.user ||
            (0, systemContext_1.getSystemContext)().responsible ||
            process.env.SAP_USERNAME ||
            '';
        logger?.debug(`ListTransports: user=${user}, modifiable_only=${modifiableOnly}`);
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const state = await client.getRequest().list({
            user,
            status: modifiableOnly ? 'D' : undefined,
        });
        const transports = parseTransportListXml(state.listResult?.data || '');
        logger?.info(`ListTransports: found ${transports.length} transport(s)`);
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        count: transports.length,
                        transports,
                    }, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleListTransports.js.map