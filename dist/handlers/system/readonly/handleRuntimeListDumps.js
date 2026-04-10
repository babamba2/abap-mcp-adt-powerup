"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeListDumps = handleRuntimeListDumps;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeListDumps',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] List ABAP runtime dumps with optional user filter and paging. Returns parsed JSON payload.',
    inputSchema: {
        type: 'object',
        properties: {
            user: {
                type: 'string',
                description: 'Optional username filter. If omitted, dumps for all users are returned.',
            },
            inlinecount: {
                type: 'string',
                enum: ['allpages', 'none'],
                description: 'Include total count metadata.',
            },
            top: {
                type: 'number',
                description: 'Maximum number of records to return.',
            },
            skip: {
                type: 'number',
                description: 'Number of records to skip.',
            },
            orderby: {
                type: 'string',
                description: 'ADT order by expression.',
            },
        },
        required: [],
    },
};
async function handleRuntimeListDumps(context, args) {
    const { connection, logger } = context;
    try {
        const runtimeClient = new adt_clients_1.AdtRuntimeClient(connection, logger);
        const { user, inlinecount, top, skip, orderby } = args || {};
        const response = user
            ? await runtimeClient.listRuntimeDumpsByUser(user, {
                inlinecount,
                top,
                skip,
                orderby,
            })
            : await runtimeClient.listRuntimeDumps({
                inlinecount,
                top,
                skip,
                orderby,
            });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                user_filter: user || null,
                status: response.status,
                payload: (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data),
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error listing runtime dumps:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeListDumps.js.map