"use strict";
/**
 * Platform-specific storage implementations for mcp-abap-adt
 *
 * Updated to use new @mcp-abap-adt/auth-stores package
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
exports.getPlatformPaths = void 0;
exports.detectStoreType = detectStoreType;
exports.getPlatformStores = getPlatformStores;
exports.getPlatformStoresAsync = getPlatformStoresAsync;
var platformPaths_1 = require("./platformPaths");
Object.defineProperty(exports, "getPlatformPaths", { enumerable: true, get: function () { return platformPaths_1.getPlatformPaths; } });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
// Import new stores from @mcp-abap-adt/auth-stores
const auth_stores_1 = require("@mcp-abap-adt/auth-stores");
const platformPaths_2 = require("./platformPaths");
/**
 * Auto-detect service key format and return appropriate stores
 * @param directory Directory where service keys are stored
 * @param destination Destination name to check (optional, for auto-detection)
 * @returns Object with serviceKeyStore and sessionStore instances
 */
async function detectStoreType(directory, destination, logger) {
    // Default to ABAP for backward compatibility
    let storeType = 'abap';
    // Try to auto-detect if destination is provided
    if (destination) {
        const fileName = `${destination}.json`;
        const filePath = path.join(directory, fileName);
        if (fs.existsSync(filePath)) {
            try {
                const rawData = await auth_stores_1.JsonFileHandler.load(fileName, directory);
                if (rawData) {
                    // Check if it's ABAP format (has nested uaa object)
                    if (rawData.uaa && typeof rawData.uaa === 'object') {
                        storeType = 'abap';
                    }
                    // Check if it's XSUAA format (has url, clientid, clientsecret at root)
                    else if (rawData.url && rawData.clientid && rawData.clientsecret) {
                        // For now, use BTP store for XSUAA format (BTP uses XSUAA format)
                        // Could also use XSUAA store, but BTP is more common
                        storeType = 'btp';
                    }
                }
            }
            catch (_error) {
                // If detection fails, default to ABAP
                storeType = 'abap';
            }
        }
    }
    // Create stores based on detected type
    switch (storeType) {
        case 'abap':
            return {
                serviceKeyStore: new auth_stores_1.AbapServiceKeyStore(directory, logger),
                sessionStore: new auth_stores_1.AbapSessionStore(directory, logger),
                storeType: 'abap',
            };
        case 'btp':
            return {
                serviceKeyStore: new auth_stores_1.BtpServiceKeyStore(directory, logger),
                sessionStore: new auth_stores_1.BtpSessionStore(directory, '', logger),
                storeType: 'btp',
            };
        // XSUAA format uses BTP stores (BTP uses XSUAA service key format)
        // case 'xsuaa':
        //   return {
        //     serviceKeyStore: new XsuaaServiceKeyStore(directory),
        //     sessionStore: new XsuaaSessionStore(directory),
        //     storeType: 'xsuaa',
        //   };
    }
}
/**
 * Get platform-specific stores based on current OS
 * @param customPath Optional custom path (overrides platform defaults)
 * @param unsafe If true, use file-based SessionStore (persists to disk). If false, use SafeSessionStore (default, in-memory, secure).
 * @param destination Optional destination name for auto-detection of store type
 * @returns Object with serviceKeyStore and sessionStore instances
 */
function getPlatformStores(customPath, unsafe = false, _destination) {
    // Get platform paths and use first path as directory (new stores use single directory)
    const serviceKeysPaths = (0, platformPaths_2.getPlatformPaths)(customPath, 'service-keys');
    const sessionsPaths = (0, platformPaths_2.getPlatformPaths)(customPath, 'sessions');
    // Use first path as directory (new stores use single directory, not searchPaths)
    const serviceKeysDir = serviceKeysPaths[0];
    const sessionsDir = sessionsPaths[0];
    // For now, default to ABAP stores for backward compatibility
    // Auto-detection can be added later if needed
    const serviceKeyStore = new auth_stores_1.AbapServiceKeyStore(serviceKeysDir);
    // Use file-based or in-memory session store based on unsafe flag
    const sessionStore = unsafe
        ? new auth_stores_1.AbapSessionStore(sessionsDir)
        : new auth_stores_1.SafeAbapSessionStore();
    return {
        serviceKeyStore,
        sessionStore,
    };
}
/**
 * Get platform-specific stores with auto-detection of service key format
 * This is an async version that can detect the service key format
 * @param customPath Optional custom path (overrides platform defaults)
 * @param unsafe If true, use file-based SessionStore (persists to disk). If false, use SafeSessionStore (default, in-memory, secure).
 * @param destination Destination name for auto-detection of store type
 * @returns Promise with serviceKeyStore and sessionStore instances
 */
async function getPlatformStoresAsync(customPath, unsafe = false, destination, logger) {
    // Get platform paths and use first path as directory
    const serviceKeysPaths = (0, platformPaths_2.getPlatformPaths)(customPath, 'service-keys');
    const sessionsPaths = (0, platformPaths_2.getPlatformPaths)(customPath, 'sessions');
    // Use first path as directory
    const serviceKeysDir = serviceKeysPaths[0];
    const sessionsDir = sessionsPaths[0];
    // Auto-detect store type
    const detected = await detectStoreType(serviceKeysDir, destination, logger);
    // Use file-based or in-memory session store based on unsafe flag
    let sessionStore;
    if (unsafe) {
        switch (detected.storeType) {
            case 'abap':
                sessionStore = new auth_stores_1.AbapSessionStore(sessionsDir, logger);
                break;
            case 'btp':
                sessionStore = new auth_stores_1.BtpSessionStore(sessionsDir, '', logger);
                break;
        }
    }
    else {
        switch (detected.storeType) {
            case 'abap':
                sessionStore = new auth_stores_1.SafeAbapSessionStore(logger);
                break;
            case 'btp':
                sessionStore = new auth_stores_1.SafeBtpSessionStore('', logger);
                break;
        }
    }
    return {
        serviceKeyStore: detected.serviceKeyStore,
        sessionStore,
        storeType: detected.storeType,
    };
}
//# sourceMappingURL=index.js.map