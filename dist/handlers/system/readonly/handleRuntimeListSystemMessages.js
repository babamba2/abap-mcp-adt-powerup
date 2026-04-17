"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeListSystemMessages = handleRuntimeListSystemMessages;
const utils_1 = require("../../../lib/utils");
const runtimeFeedsHelper_1 = require("./runtimeFeedsHelper");
exports.TOOL_DEFINITION = {
    name: 'RuntimeListSystemMessages',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] List SM02 system messages. Returns structured entries with id, title, text, severity, validity period, and author.',
    inputSchema: {
        type: 'object',
        properties: {
            user: {
                type: 'string',
                description: 'Filter by author username.',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of messages to return.',
            },
            from: {
                type: 'string',
                description: 'Start of time range in YYYYMMDDHHMMSS format.',
            },
            to: {
                type: 'string',
                description: 'End of time range in YYYYMMDDHHMMSS format.',
            },
        },
        required: [],
    },
};
async function handleRuntimeListSystemMessages(context, args) {
    const { connection, logger } = context;
    try {
        const response = await (0, runtimeFeedsHelper_1.fetchFeed)(connection, runtimeFeedsHelper_1.FEED_URLS.systemMessages, {
            user: args?.user,
            maxResults: args?.max_results,
            from: args?.from,
            to: args?.to,
        }, 'user');
        const messages = (0, runtimeFeedsHelper_1.parseSystemMessages)(response.data);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                count: messages.length,
                messages,
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error listing system messages:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeListSystemMessages.js.map