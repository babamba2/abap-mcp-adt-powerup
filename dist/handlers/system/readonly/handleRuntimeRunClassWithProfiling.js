"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleRuntimeRunClassWithProfiling = handleRuntimeRunClassWithProfiling;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'RuntimeRunClassWithProfiling',
    available_in: ['onprem', 'cloud'],
    description: '[runtime] Execute ABAP class with profiler enabled and return created profilerId + traceId.',
    inputSchema: {
        type: 'object',
        properties: {
            class_name: {
                type: 'string',
                description: 'ABAP class name to execute.',
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
        required: ['class_name'],
    },
};
async function handleRuntimeRunClassWithProfiling(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.class_name) {
            throw new Error('Parameter "class_name" is required');
        }
        const className = args.class_name.trim().toUpperCase();
        const executor = new adt_clients_1.AdtExecutor(connection, logger);
        const classExecutor = executor.getClassExecutor();
        const result = await classExecutor.runWithProfiling({ className }, {
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
                class_name: className,
                profiler_id: result.profilerId,
                trace_id: result.traceId,
                run_status: result.response?.status,
                trace_requests_status: result.traceRequestsResponse?.status,
            }, null, 2),
            status: result.response?.status,
            statusText: result.response?.statusText,
            headers: result.response?.headers,
            config: result.response?.config,
        });
    }
    catch (error) {
        logger?.error('Error running class with profiling:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeRunClassWithProfiling.js.map