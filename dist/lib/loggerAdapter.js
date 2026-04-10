"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerAdapter = void 0;
const logger_1 = require("./logger");
/**
 * Adapter that implements ILogger interface using the server's logger
 *
 * Note: The ILogger interface only includes basic logging methods (info, error, warn, debug).
 * Additional methods like csrfToken and tlsConfig are handled by the server logger directly
 * and are not part of the ILogger interface.
 */
exports.loggerAdapter = {
    info: (message, meta) => {
        logger_1.logger?.info(message, meta);
    },
    error: (message, meta) => {
        logger_1.logger?.error(message, meta);
    },
    warn: (message, meta) => {
        logger_1.logger?.warn(message, meta);
    },
    debug: (message, meta) => {
        logger_1.logger?.debug(message, meta);
    },
};
//# sourceMappingURL=loggerAdapter.js.map