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
exports.handleGetInclude = handleGetInclude;
const z = __importStar(require("zod"));
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
// TODO: Migrate to infrastructure module
// This handler uses direct ADT endpoint: /sap/bc/adt/programs/includes/{name}/source/main
// AdtClient doesn't have readInclude() method
// Need infrastructure.readInclude() that returns source code
exports.TOOL_DEFINITION = {
    name: 'GetInclude',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Retrieve source code of a specific ABAP include file.',
    inputSchema: {
        include_name: z.string().describe('Name of the ABAP Include'),
    },
};
async function handleGetInclude(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.include_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Include name is required');
        }
        const url = `/sap/bc/adt/programs/includes/${(0, utils_1.encodeSapObjectName)(args.include_name)}/source/main`;
        logger?.info(`Fetching include: ${args.include_name}`);
        const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, url, 'GET', 'default');
        const plainText = response.data;
        if (args.filePath) {
            (0, writeResultToFile_1.writeResultToFile)(plainText, args.filePath);
        }
        logger?.info(`✅ GetInclude completed: ${args.include_name}`);
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: plainText,
                },
            ],
        };
    }
    catch (error) {
        logger?.error(`Error getting include ${args?.include_name ?? ''}: ${error instanceof Error ? error.message : String(error)}`);
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
//# sourceMappingURL=handleGetInclude.js.map