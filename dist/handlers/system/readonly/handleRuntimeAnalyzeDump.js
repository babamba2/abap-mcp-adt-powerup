"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeAnalyzeDump = handleRuntimeAnalyzeDump;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimeDumpFormat_1 = require("./runtimeDumpFormat");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeAnalyzeDump',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Read runtime dump by ID and return key facts (runtime error, exception, program, termination object/line, user, date, chapter index). Set include_payload=false for facts only. Pass chapters=["developer"] to get the ST22 long text reduced to the developer chapters (~10 KB instead of ~50 KB).',
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
            chapters: {
                type: 'array',
                items: { type: 'string' },
                description: 'Formatted long text only (implies view="formatted"): keep just these chapters, without box borders or padding. "developer" = Short Text, What happened?, Error analysis, Chain of Exception Objects, Information on where terminated, Source Code Extract, Active Calls/Events, User and Transaction. Other entries match chapter titles by prefix.',
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
        const chapters = Array.isArray(args.chapters)
            ? args.chapters.filter((c) => typeof c === 'string' && c.trim() !== '')
            : [];
        const view = chapters.length ? 'formatted' : (args.view ?? 'default');
        const runtimeClient = new mcp_abap_adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.getRuntimeDumpById(args.dump_id, {
            view,
        });
        let parsedPayload = (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data);
        let summary = {
            ...(0, runtimeDumpFormat_1.extractDumpFacts)(parsedPayload),
        };
        if (!Object.keys(summary).length) {
            summary = { ...(0, runtimeDumpFormat_1.extractFormattedHeaderFacts)(parsedPayload) };
        }
        if (!Object.keys(summary).length) {
            collectKeyFacts(parsedPayload, summary);
        }
        if (chapters.length && typeof parsedPayload === 'string') {
            parsedPayload = (0, runtimeDumpFormat_1.compactFormattedDump)(parsedPayload, chapters);
        }
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