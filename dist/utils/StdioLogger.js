"use strict";
/**
 * StdioLogger - minimal logger for stdio transport
 *
 * Only writes errors to stderr, all other log levels are no-ops
 * This is required because MCP protocol over stdio requires only JSON-RPC messages on stdout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioLogger = void 0;
/**
 * Minimal logger for stdio transport
 * Only errors are written to stderr, all other methods are no-ops
 */
class StdioLogger {
    info(_message, ..._args) {
        // No-op for stdio - MCP protocol requires only JSON-RPC messages on stdout
    }
    error(message, ...args) {
        // Write errors to stderr for stdio transport
        const errorMsg = args.length > 0
            ? `${message} ${args.map((a) => (a instanceof Error ? a.message : JSON.stringify(a))).join(' ')}`
            : message;
        process.stderr.write(`[ERROR] ${errorMsg}\n`);
    }
    warn(_message, ..._args) {
        // No-op for stdio
    }
    debug(_message, ..._args) {
        // No-op for stdio
    }
}
exports.StdioLogger = StdioLogger;
//# sourceMappingURL=StdioLogger.js.map