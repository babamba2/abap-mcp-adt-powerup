"use strict";
/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 *
 * Description for MCP server:
 * Name: Get full code for program or function group
 * Description: Returns the full code for a given ABAP program (report) or function group, including all includes. The main object (report or function group) always comes first in the response, followed by all child includes in tree traversal order.
 *
 * Parameters:
 * - name: technical name of the program or function group (string, e.g., "/CBY/MM_INVENTORY") — required
 * - type: "PROG/P" for program or "FUGR" for function group (string, required)
 * - output: "inline" (default) or "file"
 *
 * Returns (inline): JSON:
 *   {
 *     name: string, // technical name of the main object
 *     type: string, // "PROG/P" or "FUGR"
 *     total_code_objects: number, // total number of code objects (main + all includes)
 *     code_objects: [
 *       {
 *         OBJECT_TYPE: string, // "PROG/P" (main program), "FUGR" (function group), or "PROG/I" (include)
 *         OBJECT_NAME: string, // technical name of the object
 *         code: string         // ABAP source (runs of spaces collapsed to one)
 *       }
 *     ]
 *   }
 *
 * Returns (file): every object is written unchanged to
 * <MCP output dir>/src/<main>/<object>.abap and the response lists
 * { object_type, object_name, path, lines, bytes, outline } per object.
 *
 * Notes:
 * - All includes are resolved recursively (INCLUDE x. with or without a
 *   trailing " comment, and INCLUDE: a, b.) and added after the main object.
 * - The order is: main object first, then all includes in tree traversal order.
 * - A function group's main source is read from its source/main endpoint
 *   (SAPL<group> cannot be read as a program include).
 *
 * Purpose: mass code export, audit, dependency analysis, migration, backup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.findIncludes = findIncludes;
exports.handleGetProgFullCode = handleGetProgFullCode;
const clients_1 = require("../../../lib/clients");
const sourceOutput_1 = require("../../../lib/sourceOutput");
const utils_1 = require("../../../lib/utils");
const handleGetInclude_1 = require("../../include/readonly/handleGetInclude");
exports.TOOL_DEFINITION = {
    name: 'GetProgFullCode',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Returns the full code for a program or function group, including all includes, in tree traversal order. Use output="file" to get paths + outlines instead of the code.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: "Technical name of the program or function group (e.g., '/CBY/MM_INVENTORY')",
            },
            type: {
                type: 'string',
                enum: ['PROG/P', 'FUGR'],
                description: "'PROG/P' for program or 'FUGR' for function group",
            },
            output: {
                type: 'string',
                enum: ['inline', 'file'],
                description: sourceOutput_1.OUTPUT_PARAM_DESCRIPTION,
                default: 'inline',
            },
        },
        required: ['name', 'type'],
    },
};
/** INCLUDE x.  /  INCLUDE x. " comment  /  INCLUDE: a, b. */
function findIncludes(code) {
    const names = [];
    for (const m of code.matchAll(/^\s*INCLUDE\s+([A-Z0-9_/]+)\s*\.\s*(?:".*)?$/gim)) {
        names.push(m[1].toUpperCase());
    }
    for (const m of code.matchAll(/^\s*INCLUDE:\s*([A-Z0-9_/,\s]+)\./gim)) {
        for (const n of m[1].split(',')) {
            const name = n.trim();
            if (name)
                names.push(name.toUpperCase());
        }
    }
    return names.filter((n) => n !== 'STRUCTURE' && n !== 'TYPE');
}
function asText(data) {
    if (typeof data === 'string')
        return data;
    if (data === undefined || data === null)
        return null;
    return JSON.stringify(data);
}
/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 * @param args { name: string, type: "PROG/P" | "FUGR", output?: "inline" | "file" }
 */
async function handleGetProgFullCode(context, args) {
    const { connection } = context;
    const { name, type } = args;
    const typeUpper = type.toUpperCase();
    // Each include is fetched once, however often it is referenced.
    const includeCache = new Map();
    async function fetchInclude(includeName) {
        if (includeCache.has(includeName)) {
            return includeCache.get(includeName) ?? null;
        }
        const result = await (0, handleGetInclude_1.handleGetInclude)(context, {
            include_name: includeName,
        });
        let code = null;
        const c = result?.content?.[0];
        if (!result?.isError && c?.type === 'text' && 'text' in c) {
            code = asText(c.text);
        }
        includeCache.set(includeName, code);
        return code;
    }
    // Depth-first: an include is followed directly by the includes it pulls in.
    async function collect(includeName, seen, out) {
        if (seen.has(includeName))
            return;
        seen.add(includeName);
        const code = await fetchInclude(includeName);
        out.push({ OBJECT_TYPE: 'PROG/I', OBJECT_NAME: includeName, code });
        if (code) {
            for (const nested of findIncludes(code)) {
                await collect(nested, seen, out);
            }
        }
    }
    try {
        const codeObjects = [];
        let mainCode = null;
        if (typeUpper === 'PROG/P') {
            const client = (0, clients_1.createAdtClient)(connection);
            const progState = await client.getProgram().read({
                programName: name,
            });
            mainCode = asText(progState?.readResult?.data);
            if (!mainCode) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `No program code found for ${name}. Result: ${progState?.readResult ? 'exists but no sourceCode' : 'undefined'}`,
                        },
                    ],
                };
            }
            codeObjects.push({
                OBJECT_TYPE: 'PROG/P',
                OBJECT_NAME: name,
                code: mainCode,
            });
        }
        else if (typeUpper === 'FUGR') {
            // getFunctionGroup().read() returns the group's metadata XML, not its
            // source; the SAPL main program comes from source/main.
            const response = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `/sap/bc/adt/functions/groups/${(0, utils_1.encodeSapObjectName)(name)}/source/main`, 'GET', 'default');
            mainCode = asText(response?.data);
            if (!mainCode) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `No function group code found for ${name}.`,
                        },
                    ],
                };
            }
            codeObjects.push({
                OBJECT_TYPE: 'FUGR',
                OBJECT_NAME: name,
                code: mainCode,
            });
        }
        else {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'Unsupported type',
                    },
                ],
            };
        }
        const seen = new Set();
        for (const inc of findIncludes(mainCode)) {
            await collect(inc, seen, codeObjects);
        }
        if ((0, sourceOutput_1.isFileOutput)(args)) {
            const subdir = (0, sourceOutput_1.sourceFileName)(name, typeUpper === 'FUGR' ? 'fugr' : 'prog').replace(/\.abap$/, '');
            const files = codeObjects.map((obj) => {
                if (obj.code === null) {
                    return {
                        object_type: obj.OBJECT_TYPE,
                        object_name: obj.OBJECT_NAME,
                        error: 'source not found',
                    };
                }
                const kind = obj.OBJECT_TYPE === 'PROG/I'
                    ? 'incl'
                    : obj.OBJECT_TYPE === 'FUGR'
                        ? 'fugr'
                        : 'prog';
                return {
                    object_type: obj.OBJECT_TYPE,
                    object_name: obj.OBJECT_NAME,
                    ...(0, sourceOutput_1.writeSourceFile)((0, sourceOutput_1.sourceFileName)(obj.OBJECT_NAME, kind), obj.code, subdir),
                };
            });
            return {
                isError: false,
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            name,
                            type,
                            output: 'file',
                            total_code_objects: files.length,
                            code_objects: files,
                        }),
                    },
                ],
            };
        }
        // Inline: collapse runs of spaces to keep the response small.
        const fullResult = {
            name,
            type,
            total_code_objects: codeObjects.length,
            code_objects: codeObjects.map((obj) => ({
                ...obj,
                code: typeof obj.code === 'string'
                    ? obj.code.replace(/ {2,}/g, ' ')
                    : obj.code,
            })),
        };
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(fullResult),
                },
            ],
        };
    }
    catch (e) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: e instanceof Error ? e.message : String(e),
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetProgFullCode.js.map