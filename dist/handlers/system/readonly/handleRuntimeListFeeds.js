"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeListFeeds = handleRuntimeListFeeds;
const utils_1 = require("../../../lib/utils");
const runtimeFeedsHelper_1 = require("./runtimeFeedsHelper");
const ATOM_FEED_HEADERS = { Accept: 'application/atom+xml;type=feed' };
exports.TOOL_DEFINITION = {
    name: 'RuntimeListFeeds',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] List available ADT runtime feeds or read a specific feed type. Feed types: dumps, system_messages, gateway_errors. Without feed_type returns available feed descriptors.',
    inputSchema: {
        type: 'object',
        properties: {
            feed_type: {
                type: 'string',
                enum: [
                    'descriptors',
                    'variants',
                    'dumps',
                    'system_messages',
                    'gateway_errors',
                ],
                description: 'Feed to read. "descriptors" lists available feeds, "variants" lists feed variants, others read that specific feed. Default: descriptors.',
                default: 'descriptors',
            },
            user: {
                type: 'string',
                description: 'Filter feed entries by SAP username.',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of entries to return.',
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
async function handleRuntimeListFeeds(context, args) {
    const { connection, logger } = context;
    try {
        const feedType = args?.feed_type ?? 'descriptors';
        const queryOptions = {
            user: args?.user,
            maxResults: args?.max_results,
            from: args?.from,
            to: args?.to,
        };
        let data;
        let response;
        switch (feedType) {
            case 'descriptors': {
                response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/feeds', 'GET', 'default', undefined, undefined, ATOM_FEED_HEADERS);
                data = (0, runtimeFeedsHelper_1.parseFeedDescriptors)(response.data);
                break;
            }
            case 'variants': {
                response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, '/sap/bc/adt/feeds/variants', 'GET', 'default', undefined, undefined, ATOM_FEED_HEADERS);
                data = (0, runtimeFeedsHelper_1.parseFeedVariants)(response.data);
                break;
            }
            case 'dumps': {
                response = await (0, runtimeFeedsHelper_1.fetchFeed)(connection, runtimeFeedsHelper_1.FEED_URLS.dumps, queryOptions, 'user');
                data = (0, runtimeFeedsHelper_1.parseRuntimeDumpFeed)(response.data);
                break;
            }
            case 'system_messages': {
                response = await (0, runtimeFeedsHelper_1.fetchFeed)(connection, runtimeFeedsHelper_1.FEED_URLS.systemMessages, queryOptions, 'user');
                data = (0, runtimeFeedsHelper_1.parseSystemMessages)(response.data);
                break;
            }
            case 'gateway_errors': {
                response = await (0, runtimeFeedsHelper_1.fetchFeed)(connection, runtimeFeedsHelper_1.FEED_URLS.gatewayErrors, queryOptions, 'username');
                data = (0, runtimeFeedsHelper_1.parseGatewayErrors)(response.data);
                break;
            }
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                feed_type: feedType,
                count: Array.isArray(data) ? data.length : undefined,
                entries: data,
            }, null, 2),
            status: response?.status ?? 200,
            statusText: response?.statusText ?? 'OK',
            headers: response?.headers ?? {},
            config: response?.config ?? {},
        });
    }
    catch (error) {
        logger?.error('Error reading feeds:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeListFeeds.js.map