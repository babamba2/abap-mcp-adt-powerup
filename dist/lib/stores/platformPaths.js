"use strict";
/**
 * Platform-specific path resolution for mcp-abap-adt
 *
 * Defines default paths for service keys and sessions:
 * - Unix: ~/.config/mcp-abap-adt/service-keys, ~/.config/mcp-abap-adt/sessions
 * - Windows: %USERPROFILE%\Documents\mcp-abap-adt\service-keys, %USERPROFILE%\Documents\mcp-abap-adt\sessions
 */
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
exports.getPlatformPaths = getPlatformPaths;
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
/**
 * Get platform-specific default paths for service keys and sessions
 *
 * Priority:
 * 1. Custom path (if provided)
 * 2. AUTH_BROKER_PATH environment variable
 * 3. Platform-specific standard paths:
 *    - Unix: ~/.config/mcp-abap-adt/service-keys, ~/.config/mcp-abap-adt/sessions
 *    - Windows: %USERPROFILE%\Documents\mcp-abap-adt\service-keys, %USERPROFILE%\Documents\mcp-abap-adt\sessions
 * 4. Current working directory (process.cwd())
 *
 * @param customPath Optional custom path (highest priority)
 * @param subfolder Subfolder name ('service-keys' or 'sessions')
 * @returns Array of resolved absolute paths
 */
function getPlatformPaths(customPath, subfolder) {
    const paths = [];
    const isWindows = process.platform === 'win32';
    // Priority 1: Custom path from constructor
    // customPath is ALWAYS a base path - we add subfolder to it
    if (customPath) {
        if (Array.isArray(customPath)) {
            // For arrays, add subfolder to each path if subfolder is specified
            paths.push(...customPath.map((p) => {
                let resolved = path.resolve(p);
                // If path already ends with subfolder, use parent directory as base
                if (subfolder && path.basename(resolved) === subfolder) {
                    resolved = path.dirname(resolved);
                }
                return subfolder ? path.join(resolved, subfolder) : resolved;
            }));
        }
        else {
            // For single path, add subfolder if specified
            // customPath is ALWAYS a base path - we add subfolder to it
            let resolved = path.resolve(customPath);
            // If path already ends with subfolder, use parent directory as base
            if (subfolder && path.basename(resolved) === subfolder) {
                resolved = path.dirname(resolved);
            }
            paths.push(subfolder ? path.join(resolved, subfolder) : resolved);
        }
    }
    // Priority 2: AUTH_BROKER_PATH environment variable
    // AUTH_BROKER_PATH is ALWAYS a base path - we add subfolder to it
    const envPath = process.env.AUTH_BROKER_PATH;
    if (envPath) {
        // Support both colon (Unix) and semicolon (Windows) separators
        const envPaths = envPath
            .split(/[:;]/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        paths.push(...envPaths.map((p) => {
            let resolved = path.resolve(p);
            // If path already ends with subfolder, use parent directory as base
            if (subfolder && path.basename(resolved) === subfolder) {
                resolved = path.dirname(resolved);
            }
            return subfolder ? path.join(resolved, subfolder) : resolved;
        }));
    }
    // Priority 3: Platform-specific standard paths
    if (paths.length === 0) {
        // Only add platform-specific paths if no custom paths were provided
        const homeDir = os.homedir();
        if (isWindows) {
            // Windows: %USERPROFILE%\Documents\mcp-abap-adt\{subfolder}
            const basePath = path.join(homeDir, 'Documents', 'mcp-abap-adt');
            if (subfolder) {
                paths.push(path.join(basePath, subfolder));
            }
            else {
                paths.push(basePath);
            }
        }
        else {
            // Unix (Linux/macOS): ~/.config/mcp-abap-adt/{subfolder}
            const basePath = path.join(homeDir, '.config', 'mcp-abap-adt');
            if (subfolder) {
                paths.push(path.join(basePath, subfolder));
            }
            else {
                paths.push(basePath);
            }
        }
    }
    // Priority 4: Current working directory (always added as fallback)
    paths.push(process.cwd());
    // Remove duplicates while preserving order
    const uniquePaths = [];
    const seen = new Set();
    for (const p of paths) {
        const normalized = path.normalize(p);
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniquePaths.push(normalized);
        }
    }
    return uniquePaths;
}
//# sourceMappingURL=platformPaths.js.map