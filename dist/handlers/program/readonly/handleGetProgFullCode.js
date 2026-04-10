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
 *
 * Returns: JSON:
 *   {
 *     name: string, // technical name of the main object
 *     type: string, // "PROG/P" or "FUGR"
 *     total_code_objects: number, // total number of code objects (main + all includes)
 *     code_objects: [
 *       {
 *         OBJECT_TYPE: string, // "PROG/P" (main program), "FUGR" (function group), or "PROG/I" (include)
 *         OBJECT_NAME: string, // technical name of the object
 *         code: string         // full ABAP source code of the object (entire code, not a fragment)
 *       }
 *     ]
 *   }
 *
 * Notes:
 * - The "code" field always contains the full source code for each object (not truncated).
 * - All includes are resolved recursively and added after the main object.
 * - The order is: main object first, then all includes in tree traversal order.
 * - If the object or code is not found, an error is returned.
 *
 * Purpose: mass code export, audit, dependency analysis, migration, backup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetProgFullCode = handleGetProgFullCode;
exports.TOOL_DEFINITION = {
    name: 'GetProgFullCode',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Returns the full code for a program or function group, including all includes, in tree traversal order.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: "[read-only] Technical name of the program or function group (e.g., '/CBY/MM_INVENTORY')",
            },
            type: {
                type: 'string',
                enum: ['PROG/P', 'FUGR'],
                description: "[read-only] 'PROG/P' for program or 'FUGR' for function group",
            },
        },
        required: ['name', 'type'],
    },
};
const clients_1 = require("../../../lib/clients");
const handleGetInclude_1 = require("../../include/readonly/handleGetInclude");
/**
 * handleGetProgFullCode: returns full code for program (report) or function group with all includes.
 * @param args { name: string, type: "PROG/P" | "FUGR" }
 */
async function handleGetProgFullCode(context, args) {
    const { connection } = context;
    const { name, type } = args;
    const typeUpper = type.toUpperCase();
    // Helper to recursively collect includes for a program/include
    async function collectIncludes(objectName, collected = new Set()) {
        if (collected.has(objectName))
            return [];
        collected.add(objectName);
        // Try to get include source
        const includeResult = await (0, handleGetInclude_1.handleGetInclude)(context, {
            include_name: objectName,
        });
        let code = null;
        if (Array.isArray(includeResult?.content) &&
            includeResult.content.length > 0) {
            const c = includeResult.content[0];
            if (c.type === 'text' && 'data' in c)
                code = c.data;
        }
        // Find nested includes in code (ABAP: INCLUDE <name>. or 'INCLUDE <name> .')
        const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_/]+)\s*\.\s*$/gim;
        const nested = [];
        if (typeof code === 'string') {
            let match = includeRegex.exec(code);
            while (match !== null) {
                nested.push(match[1]);
                match = includeRegex.exec(code);
            }
        }
        // Recursively collect all nested includes
        let allNested = [];
        for (const inc of nested) {
            allNested = allNested.concat(await collectIncludes(inc, collected));
        }
        return [objectName, ...allNested];
    }
    try {
        let codeObjects = [];
        if (typeUpper === 'PROG/P') {
            // Get main program code
            const client = (0, clients_1.createAdtClient)(connection);
            const progState = await client.getProgram().read({
                programName: name,
            });
            const progResult = progState?.readResult;
            let progCode = null;
            if (progResult?.data) {
                if (typeof progResult.data === 'string') {
                    progCode = progResult.data;
                }
                else {
                    progCode = JSON.stringify(progResult.data);
                }
            }
            if (typeof progCode !== 'string' || progCode === '') {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `No program code found for ${name}. Result: ${progResult ? 'exists but no sourceCode' : 'undefined'}`,
                        },
                    ],
                };
            }
            codeObjects.push({
                OBJECT_TYPE: 'PROG/P',
                OBJECT_NAME: name,
                code: progCode,
            });
            // Find all includes in program code
            const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_/]+)\s*\.\s*$/gim;
            const includeListRegex = /^\s*INCLUDE:\s*([A-Z0-9_/,\s]+)\./gim;
            const includes = [];
            if (typeof progCode === 'string') {
                let match = includeRegex.exec(progCode);
                // Match single INCLUDE <name>.
                while (match !== null) {
                    includes.push(match[1]);
                    match = includeRegex.exec(progCode);
                }
                // Match INCLUDE: <name1>, <name2>, ...
                let listMatch = includeListRegex.exec(progCode);
                while (listMatch !== null) {
                    const list = listMatch[1]
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    includes.push(...list);
                    listMatch = includeListRegex.exec(progCode);
                }
            }
            // Recursively collect all includes (with deduplication)
            const collected = new Set();
            for (const inc of includes) {
                const all = await collectIncludes(inc, collected);
                for (const incName of all) {
                    if (!codeObjects.some((obj) => obj.OBJECT_TYPE === 'PROG/I' && obj.OBJECT_NAME === incName)) {
                        // Get code for each include
                        const incResult = await (0, handleGetInclude_1.handleGetInclude)(context, {
                            include_name: incName,
                        });
                        let incCode = null;
                        if (Array.isArray(incResult?.content) &&
                            incResult.content.length > 0) {
                            const c = incResult.content[0];
                            if (c.type === 'text' && 'text' in c)
                                incCode = c.text;
                        }
                        codeObjects.push({
                            OBJECT_TYPE: 'PROG/I',
                            OBJECT_NAME: incName,
                            code: incCode,
                        });
                    }
                }
            }
        }
        else if (typeUpper === 'FUGR') {
            // Get function group main code
            const client = (0, clients_1.createAdtClient)(connection);
            const fgState = await client.getFunctionGroup().read({
                functionGroupName: name,
            });
            let fgCode = null;
            const rawResult = fgState?.readResult;
            if (rawResult?.data) {
                if (typeof rawResult.data === 'string') {
                    fgCode = rawResult.data;
                }
                else {
                    fgCode = JSON.stringify(rawResult.data);
                }
            }
            if (typeof fgCode !== 'string') {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `No function group code found for ${name}. Result: ${rawResult ? 'exists but no data' : 'undefined'}`,
                        },
                    ],
                };
            }
            codeObjects.push({
                OBJECT_TYPE: 'FUGR',
                OBJECT_NAME: name,
                code: fgCode,
            });
            // Find all includes in function group code
            const includeRegex = /^\s*INCLUDE\s+([A-Z0-9_/]+)\s*\.\s*$/gim;
            const includes = [];
            if (typeof fgCode === 'string') {
                let match = includeRegex.exec(fgCode);
                while (match !== null) {
                    includes.push(match[1]);
                    match = includeRegex.exec(fgCode);
                }
            }
            // Recursively collect all includes (with deduplication)
            const collected = new Set();
            for (const inc of includes) {
                const all = await collectIncludes(inc, collected);
                for (const incName of all) {
                    if (!codeObjects.some((obj) => obj.OBJECT_TYPE === 'PROG/I' && obj.OBJECT_NAME === incName)) {
                        // Get code for each include
                        const incResult = await (0, handleGetInclude_1.handleGetInclude)(context, {
                            include_name: incName,
                        });
                        let incCode = null;
                        if (Array.isArray(incResult?.content) &&
                            incResult.content.length > 0) {
                            const c = incResult.content[0];
                            if (c.type === 'text' && 'data' in c)
                                incCode = c.data;
                        }
                        codeObjects.push({
                            OBJECT_TYPE: 'PROG/I',
                            OBJECT_NAME: incName,
                            code: incCode,
                        });
                    }
                }
            }
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
        // Normalize spaces in code fields: replace 2+ spaces with 1
        codeObjects = codeObjects.map((obj) => ({
            ...obj,
            code: typeof obj.code === 'string'
                ? obj.code.replace(/ {2,}/g, ' ')
                : obj.code,
        }));
        const fullResult = {
            name,
            type,
            total_code_objects: codeObjects.length,
            code_objects: codeObjects,
        };
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(fullResult, null, 2),
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