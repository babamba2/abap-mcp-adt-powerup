"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeAnalyzeProfilerTrace = handleRuntimeAnalyzeProfilerTrace;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeAnalyzeProfilerTrace',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Read profiler trace view and return compact analysis summary (totals + top entries).',
    inputSchema: {
        type: 'object',
        properties: {
            trace_id_or_uri: {
                type: 'string',
                description: 'Profiler trace ID or full trace URI.',
            },
            view: {
                type: 'string',
                enum: ['hitlist', 'statements', 'db_accesses'],
                default: 'hitlist',
            },
            top: {
                type: 'number',
                description: 'Number of top rows for summary. Default: 10.',
            },
            with_system_events: {
                type: 'boolean',
                description: 'Include system events.',
            },
        },
        required: ['trace_id_or_uri'],
    },
};
function collectObjects(value, acc) {
    if (!value) {
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectObjects(item, acc);
        }
        return;
    }
    if (typeof value === 'object') {
        const record = value;
        acc.push(record);
        for (const nested of Object.values(record)) {
            collectObjects(nested, acc);
        }
    }
}
function pickTopEntries(payload, top) {
    const objects = [];
    collectObjects(payload, objects);
    const candidateRows = objects.filter((obj) => Object.values(obj).some((val) => typeof val === 'number'));
    const rankingKeys = [
        'grossTime',
        'gross_time',
        'netTime',
        'net_time',
        'duration',
        'runtime',
        'calls',
        'count',
        'hits',
    ];
    const resolveRankValue = (obj) => {
        for (const key of rankingKeys) {
            const value = obj[key];
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
        }
        return 0;
    };
    const sorted = [...candidateRows]
        .sort((a, b) => resolveRankValue(b) - resolveRankValue(a))
        .slice(0, Math.max(1, top))
        .map((item) => {
        const compact = {};
        for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean') {
                compact[key] = value;
            }
        }
        return compact;
    });
    return {
        total_records: candidateRows.length,
        top_records: sorted,
    };
}
async function handleRuntimeAnalyzeProfilerTrace(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.trace_id_or_uri) {
            throw new Error('Parameter "trace_id_or_uri" is required');
        }
        const view = args.view ?? 'hitlist';
        const runtimeClient = new mcp_abap_adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = view === 'hitlist'
            ? await runtimeClient.getProfilerTraceHitList(args.trace_id_or_uri, {
                withSystemEvents: args.with_system_events,
            })
            : view === 'statements'
                ? await runtimeClient.getProfilerTraceStatements(args.trace_id_or_uri, {
                    withSystemEvents: args.with_system_events,
                })
                : await runtimeClient.getProfilerTraceDbAccesses(args.trace_id_or_uri, {
                    withSystemEvents: args.with_system_events,
                });
        const parsedPayload = (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data);
        const summary = pickTopEntries(parsedPayload, args.top ?? 10);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                trace_id_or_uri: args.trace_id_or_uri,
                view,
                status: response.status,
                summary,
                payload: parsedPayload,
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error analyzing profiler trace:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeAnalyzeProfilerTrace.js.map