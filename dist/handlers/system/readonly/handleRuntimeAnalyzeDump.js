"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeAnalyzeDump = handleRuntimeAnalyzeDump;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeAnalyzeDump',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Read runtime dump by ID and return compact analysis summary with key fields.',
    inputSchema: {
        type: 'object',
        properties: {
            dump_id: {
                type: 'string',
                description: 'Runtime dump ID.',
            },
            view: {
                type: 'string',
                enum: ['default', 'summary', 'formatted'],
                description: 'Dump view mode to analyze: default payload, summary section, or formatted long text.',
                default: 'default',
            },
            include_payload: {
                type: 'boolean',
                description: 'Include full parsed payload in response.',
                default: true,
            },
        },
        required: ['dump_id'],
    },
};
function collectKeyFacts(value, target, depth = 0) {
    if (!value || depth > 8 || Object.keys(target).length >= 20) {
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectKeyFacts(item, target, depth + 1);
        }
        return;
    }
    if (typeof value !== 'object') {
        return;
    }
    const interestingKeys = [
        'title',
        'shorttext',
        'shortText',
        'category',
        'exception',
        'program',
        'include',
        'line',
        'user',
        'date',
        'time',
        'host',
        'application',
        'component',
        'client',
    ];
    const obj = value;
    for (const [key, nested] of Object.entries(obj)) {
        const keyNormalized = key.toLowerCase();
        const isInteresting = interestingKeys.some((candidate) => keyNormalized === candidate.toLowerCase());
        if (isInteresting &&
            target[key] === undefined &&
            (typeof nested === 'string' ||
                typeof nested === 'number' ||
                typeof nested === 'boolean')) {
            target[key] = nested;
        }
        collectKeyFacts(nested, target, depth + 1);
    }
}
async function handleRuntimeAnalyzeDump(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.dump_id) {
            throw new Error('Parameter "dump_id" is required');
        }
        const view = args.view ?? 'default';
        const runtimeClient = new adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.getRuntimeDumpById(args.dump_id, {
            view,
        });
        const parsedPayload = (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data);
        const summary = {};
        collectKeyFacts(parsedPayload, summary);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                dump_id: args.dump_id,
                view,
                status: response.status,
                summary,
                payload: args.include_payload === false ? undefined : parsedPayload,
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error analyzing runtime dump:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeAnalyzeDump.js.map