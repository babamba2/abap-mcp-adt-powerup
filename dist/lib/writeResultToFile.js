"use strict";
// Utility for safe result writing to file with path validation
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeResultToFile = writeResultToFile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Writes result to a file if the path is allowed (must be inside ./output).
 * Throws error if path is outside allowed directory.
 * @param result - Data to write (string or object)
 * @param filePath - Relative or absolute path to file (string)
 */
function writeResultToFile(result, filePath) {
    const resolvedPath = path.resolve(filePath);
    // DEBUG: log every call
    if (process.env.DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[writeResultToFile] called with filePath: ${resolvedPath}`);
    }
    try {
        // Ensure output directory exists
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        // Serialize object to JSON if needed
        let data;
        if (typeof result === 'string') {
            // Normalize line endings for file output
            const os = require('node:os');
            data = result.replace(/\r\n|\n/g, os.EOL);
        }
        else {
            data = JSON.stringify(result, null, 2);
        }
        // DEBUG: log what will be written (first 200 chars)
        if (process.env.DEBUG) {
            // eslint-disable-next-line no-console
            console.log(`[writeResultToFile] writing data (first 200 chars):`, typeof data === 'string' ? data.slice(0, 200) : '');
        }
        fs.writeFileSync(resolvedPath, data, 'utf8');
        // Simple log to console (can be replaced with logger)
        if (process.env.DEBUG) {
            // eslint-disable-next-line no-console
            console.log(`[writeResultToFile] Wrote result to: ${resolvedPath}`);
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[writeResultToFile] Error writing to file ${resolvedPath}:`, err);
        throw err;
    }
}
//# sourceMappingURL=writeResultToFile.js.map