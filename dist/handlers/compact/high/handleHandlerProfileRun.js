"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleHandlerProfileRun = handleHandlerProfileRun;
const handleRuntimeRunClassWithProfiling_1 = require("../../system/readonly/handleRuntimeRunClassWithProfiling");
const handleRuntimeRunProgramWithProfiling_1 = require("../../system/readonly/handleRuntimeRunProgramWithProfiling");
const compactSchemas_1 = require("./compactSchemas");
exports.TOOL_DEFINITION = {
    name: 'HandlerProfileRun',
    available_in: ['onprem'],
    description: 'Runtime profiling run. object_type: not used. Required: target_type*(CLASS|PROGRAM) + class_name* for CLASS or program_name* for PROGRAM. Optional profiling flags and description. Response: JSON.',
    inputSchema: compactSchemas_1.compactProfileRunSchema,
};
async function handleHandlerProfileRun(context, args) {
    if (args.target_type === 'CLASS') {
        if (!args.class_name) {
            throw new Error('class_name is required when target_type is CLASS');
        }
        return (0, handleRuntimeRunClassWithProfiling_1.handleRuntimeRunClassWithProfiling)(context, {
            class_name: args.class_name,
            description: args.description,
            all_procedural_units: args.all_procedural_units,
            all_misc_abap_statements: args.all_misc_abap_statements,
            all_internal_table_events: args.all_internal_table_events,
            all_dynpro_events: args.all_dynpro_events,
            aggregate: args.aggregate,
            explicit_on_off: args.explicit_on_off,
            with_rfc_tracing: args.with_rfc_tracing,
            all_system_kernel_events: args.all_system_kernel_events,
            sql_trace: args.sql_trace,
            all_db_events: args.all_db_events,
            max_size_for_trace_file: args.max_size_for_trace_file,
            amdp_trace: args.amdp_trace,
            max_time_for_tracing: args.max_time_for_tracing,
        });
    }
    if (!args.program_name) {
        throw new Error('program_name is required when target_type is PROGRAM');
    }
    return (0, handleRuntimeRunProgramWithProfiling_1.handleRuntimeRunProgramWithProfiling)(context, {
        program_name: args.program_name,
        description: args.description,
        all_procedural_units: args.all_procedural_units,
        all_misc_abap_statements: args.all_misc_abap_statements,
        all_internal_table_events: args.all_internal_table_events,
        all_dynpro_events: args.all_dynpro_events,
        aggregate: args.aggregate,
        explicit_on_off: args.explicit_on_off,
        with_rfc_tracing: args.with_rfc_tracing,
        all_system_kernel_events: args.all_system_kernel_events,
        sql_trace: args.sql_trace,
        all_db_events: args.all_db_events,
        max_size_for_trace_file: args.max_size_for_trace_file,
        amdp_trace: args.amdp_trace,
        max_time_for_tracing: args.max_time_for_tracing,
    });
}
//# sourceMappingURL=handleHandlerProfileRun.js.map