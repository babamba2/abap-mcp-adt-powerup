"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeCreateProfilerTraceParameters = handleRuntimeCreateProfilerTraceParameters;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RuntimeCreateProfilerTraceParameters',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Create ABAP profiler trace parameters and return profilerId (URI) for profiled execution.',
    inputSchema: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: 'Human-readable trace description.',
            },
            all_misc_abap_statements: { type: 'boolean' },
            all_procedural_units: { type: 'boolean' },
            all_internal_table_events: { type: 'boolean' },
            all_dynpro_events: { type: 'boolean' },
            aggregate: { type: 'boolean' },
            explicit_on_off: { type: 'boolean' },
            with_rfc_tracing: { type: 'boolean' },
            all_system_kernel_events: { type: 'boolean' },
            sql_trace: { type: 'boolean' },
            all_db_events: { type: 'boolean' },
            max_size_for_trace_file: { type: 'number' },
            amdp_trace: { type: 'boolean' },
            max_time_for_tracing: { type: 'number' },
        },
        required: ['description'],
    },
};
async function handleRuntimeCreateProfilerTraceParameters(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.description) {
            throw new Error('Parameter "description" is required');
        }
        const runtimeClient = new mcp_abap_adt_clients_1.AdtRuntimeClient(connection, logger);
        const response = await runtimeClient.createProfilerTraceParameters({
            description: args.description,
            allMiscAbapStatements: args.all_misc_abap_statements,
            allProceduralUnits: args.all_procedural_units,
            allInternalTableEvents: args.all_internal_table_events,
            allDynproEvents: args.all_dynpro_events,
            aggregate: args.aggregate,
            explicitOnOff: args.explicit_on_off,
            withRfcTracing: args.with_rfc_tracing,
            allSystemKernelEvents: args.all_system_kernel_events,
            sqlTrace: args.sql_trace,
            allDbEvents: args.all_db_events,
            maxSizeForTraceFile: args.max_size_for_trace_file,
            amdpTrace: args.amdp_trace,
            maxTimeForTracing: args.max_time_for_tracing,
        });
        const profilerId = runtimeClient.extractProfilerIdFromResponse(response);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                profiler_id: profilerId,
                status: response.status,
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error creating profiler trace parameters:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeCreateProfilerTraceParameters.js.map