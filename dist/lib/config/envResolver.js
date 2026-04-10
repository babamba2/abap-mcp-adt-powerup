"use strict";
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
exports.resolveEnvFilePath = resolveEnvFilePath;
const path = __importStar(require("node:path"));
const platformPaths_1 = require("../stores/platformPaths");
function normalizeEnvFileName(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return trimmed;
    return trimmed.toLowerCase().endsWith('.env') ? trimmed : `${trimmed}.env`;
}
function isLikelyPath(input) {
    if (!input)
        return false;
    if (input.includes('/') || input.includes('\\'))
        return true;
    if (input.startsWith('.') || input.startsWith('~'))
        return true;
    if (path.isAbsolute(input))
        return true;
    return false;
}
function resolvePathLike(input) {
    if (path.isAbsolute(input))
        return input;
    return path.resolve(process.cwd(), input);
}
function firstPlatformSessionsDir(customPath) {
    const sessionsPaths = (0, platformPaths_1.getPlatformPaths)(customPath, 'sessions');
    const cwd = path.resolve(process.cwd());
    const nonCwd = sessionsPaths.find((p) => path.resolve(p) !== cwd);
    return nonCwd || sessionsPaths[0];
}
function resolveEnvFilePath(options) {
    const envPath = options.envPath?.trim();
    if (envPath) {
        return resolvePathLike(envPath);
    }
    const envDestination = options.envDestination?.trim();
    if (!envDestination) {
        return undefined;
    }
    // Backward compatibility: if --env was passed with a path, treat it as a path.
    if (isLikelyPath(envDestination)) {
        return resolvePathLike(envDestination);
    }
    const fileName = normalizeEnvFileName(envDestination);
    const sessionsDir = firstPlatformSessionsDir(options.authBrokerPath);
    return path.join(sessionsDir, fileName);
}
//# sourceMappingURL=envResolver.js.map