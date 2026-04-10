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
exports.TOOL_DEFINITION = void 0;
exports.handleGetPackageContents = handleGetPackageContents;
const z = __importStar(require("zod"));
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
exports.TOOL_DEFINITION = {
    name: 'GetPackageContents',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Retrieve objects inside an ABAP package as a flat list. Supports recursive traversal of subpackages.',
    inputSchema: {
        package_name: z
            .string()
            .describe('Name of the ABAP package (e.g., "ZMY_PACKAGE")'),
        include_subpackages: z
            .boolean()
            .optional()
            .describe('Include contents of subpackages recursively (default: false)'),
        max_depth: z
            .number()
            .optional()
            .describe('Maximum depth for recursive package traversal (default: 5)'),
        include_descriptions: z
            .boolean()
            .optional()
            .describe('Include object descriptions in response (default: true)'),
    },
};
async function handleGetPackageContents(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.package_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Package name is required');
        }
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        // Use the optimized list method from adt-clients 0.3.13
        const items = await utils.getPackageContentsList(args.package_name.toUpperCase(), {
            includeSubpackages: args.include_subpackages,
            maxDepth: args.max_depth,
            includeDescriptions: args.include_descriptions,
        });
        const finalResult = {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(items, null, 2),
                },
            ],
        };
        if (args.filePath) {
            (0, writeResultToFile_1.writeResultToFile)(JSON.stringify(finalResult, null, 2), args.filePath);
        }
        return finalResult;
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetPackageContents.js.map