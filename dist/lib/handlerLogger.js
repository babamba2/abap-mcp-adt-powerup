"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noopLogger = void 0;
exports.getHandlerLogger = getHandlerLogger;
const node_module_1 = require("node:module");
/**
 * Create a prefixed logger for handlers.
 * Honors AUTH_LOG_LEVEL from @mcp-abap-adt/logger; set to "error"/"warn"/"info"/"debug".
 * Use HANDLER_LOG_SILENT=true to force no-op logger for handlers.
 */
function getHandlerLogger(category, baseLogger) {
    if (process.env.HANDLER_LOG_SILENT === 'true') {
        return exports.noopLogger;
    }
    const resolvedLogger = baseLogger ?? getDefaultLogger();
    const prefix = `[${category}]`;
    const wrap = (fn) => (msg) => fn(`${prefix} ${msg}`);
    return {
        info: wrap(resolvedLogger?.info.bind(resolvedLogger)),
        debug: wrap(resolvedLogger?.debug.bind(resolvedLogger)),
        warn: wrap(resolvedLogger?.warn.bind(resolvedLogger)),
        error: wrap(resolvedLogger?.error.bind(resolvedLogger)),
    };
}
const noopFn = () => { };
exports.noopLogger = {
    info: noopFn,
    debug: noopFn,
    warn: noopFn,
    error: noopFn,
};
function getDefaultLogger() {
    const require = (0, node_module_1.createRequire)(__filename);
    const mod = require('@mcp-abap-adt/logger');
    return mod.defaultLogger ?? new mod.DefaultLogger();
}
//# sourceMappingURL=handlerLogger.js.map