"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeGetGatewayErrorLog = handleRuntimeGetGatewayErrorLog;
const utils_1 = require("../../../lib/utils");
const runtimeFeedsHelper_1 = require("./runtimeFeedsHelper");
exports.TOOL_DEFINITION = {
    name: 'RuntimeGetGatewayErrorLog',
    available_in: ['onprem'],
    description: '[runtime] List SAP Gateway error log (/IWFND/ERROR_LOG) or get error detail. Returns structured entries with type, shortText, transactionId, dateTime, username. With error_url returns full detail including serviceInfo, errorContext, sourceCode, callStack.',
    inputSchema: {
        type: 'object',
        properties: {
            error_url: {
                type: 'string',
                description: 'Feed URL of a specific error entry (from a previous list response link field). When provided, returns detailed error info instead of listing.',
            },
            user: {
                type: 'string',
                description: 'Filter errors by SAP username.',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of errors to return.',
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
async function handleRuntimeGetGatewayErrorLog(context, args) {
    const { connection, logger } = context;
    try {
        if (args?.error_url) {
            const detailResponse = await (0, utils_1.makeAdtRequestWithTimeout)(connection, args.error_url, 'GET', 'default', undefined, undefined, { Accept: 'application/atom+xml;type=feed' });
            const detail = (0, runtimeFeedsHelper_1.parseGatewayErrorDetail)(detailResponse.data);
            return (0, utils_1.return_response)({
                data: JSON.stringify({
                    success: true,
                    mode: 'detail',
                    error: detail,
                }, null, 2),
                status: detailResponse.status,
                statusText: detailResponse.statusText,
                headers: detailResponse.headers,
                config: detailResponse.config,
            });
        }
        const listResponse = await (0, runtimeFeedsHelper_1.fetchFeed)(connection, runtimeFeedsHelper_1.FEED_URLS.gatewayErrors, {
            user: args?.user,
            maxResults: args?.max_results,
            from: args?.from,
            to: args?.to,
        }, 'username');
        const errors = (0, runtimeFeedsHelper_1.parseGatewayErrors)(listResponse.data);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                mode: 'list',
                count: errors.length,
                errors,
            }, null, 2),
            status: listResponse.status,
            statusText: listResponse.statusText,
            headers: listResponse.headers,
            config: listResponse.config,
        });
    }
    catch (error) {
        logger?.error('Error reading gateway error log:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeGetGatewayErrorLog.js.map