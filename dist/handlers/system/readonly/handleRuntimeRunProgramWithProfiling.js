"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeRunProgramWithProfiling = handleRuntimeRunProgramWithProfiling;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RuntimeRunProgramWithProfiling',
    available_in: ['onprem'],
    description: '[runtime] Execute ABAP program with profiler enabled and return created profilerId + traceId.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'ABAP program name to execute.',
            },
            description: {
                type: 'string',
                description: 'Profiler trace description.',
            },
            all_procedural_units: { type: 'boolean' },
            all_misc_abap_statements: { type: 'boolean' },
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
        required: ['program_name'],
    },
};
async function handleRuntimeRunProgramWithProfiling(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.program_name) {
            throw new Error('Parameter "program_name" is required');
        }
        const programName = args.program_name.trim().toUpperCase();
        const executor = new mcp_abap_adt_clients_1.AdtExecutor(connection, logger);
        const programExecutor = executor.getProgramExecutor();
        const result = await programExecutor.runWithProfiling({ programName }, {
            profilerParameters: {
                description: args.description,
                allProceduralUnits: args.all_procedural_units,
                allMiscAbapStatements: args.all_misc_abap_statements,
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
            },
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                profiler_id: result.profilerId,
                run_status: result.response?.status,
                // trace_id is not returned — program execution is fire-and-forget.
                // Use RuntimeListProfilerTraceFiles to find the trace after execution.
            }, null, 2),
            status: result.response?.status,
            statusText: result.response?.statusText,
            headers: result.response?.headers,
            config: result.response?.config,
        });
    }
    catch (error) {
        logger?.error('Error running program with profiling:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeRunProgramWithProfiling.js.map