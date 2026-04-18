"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeGetDumpById = handleRuntimeGetDumpById;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeGetDumpById',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Read a specific ABAP runtime dump by dump ID. Returns parsed JSON payload. Use response_mode="both" or "summary" to also include a compact key-facts summary (title, exception, program, line, user, date...).',
    inputSchema: {
        type: 'object',
        properties: {
            dump_id: {
                type: 'string',
                description: 'Runtime dump ID (for example: 694AB694097211F1929806D06D234D38).',
            },
            view: {
                type: 'string',
                enum: ['default', 'summary', 'formatted'],
                description: 'Dump view mode: default payload, summary section, or formatted long text.',
                default: 'default',
            },
            response_mode: {
                type: 'string',
                enum: ['payload', 'summary', 'both'],
                description: 'Controls what is returned: "payload" (default, legacy) — full parsed dump data only, "summary" — compact key facts only (title, exception, program, line, user, date...), "both" — summary + full payload.',
                default: 'payload',
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
async function handleRuntimeGetDumpById(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.dump_id) {
            throw new Error('Parameter "dump_id" is required');
        }
        const view = args.view ?? 'default';
        const responseMode = args.response_mode ?? 'payload';
        const runtimeClient = new mcp_abap_adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.getRuntimeDumpById(args.dump_id, {
            view,
        });
        const parsedPayload = (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data);
        let summary;
        if (responseMode === 'summary' || responseMode === 'both') {
            summary = {};
            collectKeyFacts(parsedPayload, summary);
        }
        const body = {
            success: true,
            dump_id: args.dump_id,
            view,
            response_mode: responseMode,
            status: response.status,
        };
        if (summary !== undefined) {
            body.summary = summary;
        }
        if (responseMode !== 'summary') {
            body.payload = parsedPayload;
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify(body, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error reading runtime dump by ID:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeGetDumpById.js.map