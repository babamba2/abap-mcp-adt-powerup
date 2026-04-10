"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetAbapAST = handleGetAbapAST;
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
exports.TOOL_DEFINITION = {
    name: 'GetAbapAST',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Parse ABAP code and return AST (Abstract Syntax Tree) in JSON format.',
    inputSchema: {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: 'ABAP source code to parse',
            },
            filePath: {
                type: 'string',
                description: 'Optional file path to write the result to',
            },
        },
        required: ['code'],
    },
};
// Simplified AST generator that doesn't depend on ANTLR until it's properly set up
class SimpleAbapASTGenerator {
    parseToAST(code) {
        try {
            // This is a placeholder implementation until ANTLR is properly configured
            // It provides basic structure analysis
            const lines = code.split('\n');
            const ast = {
                type: 'abapSource',
                sourceLength: code.length,
                lineCount: lines.length,
                structures: this.analyzeStructures(code),
                includes: this.findIncludes(code),
                classes: this.findClasses(code),
                methods: this.findMethods(code),
                dataDeclarations: this.findDataDeclarations(code),
                forms: this.findForms(code),
            };
            return ast;
        }
        catch (error) {
            throw new Error(`Failed to parse ABAP code: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    analyzeStructures(code) {
        const structures = [];
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toLowerCase();
            if (line.startsWith('class ')) {
                structures.push({
                    type: 'class',
                    line: i + 1,
                    content: lines[i].trim(),
                });
            }
            else if (line.startsWith('method ')) {
                structures.push({
                    type: 'method',
                    line: i + 1,
                    content: lines[i].trim(),
                });
            }
            else if (line.startsWith('form ')) {
                structures.push({
                    type: 'form',
                    line: i + 1,
                    content: lines[i].trim(),
                });
            }
            else if (line.startsWith('function ')) {
                structures.push({
                    type: 'function',
                    line: i + 1,
                    content: lines[i].trim(),
                });
            }
        }
        return structures;
    }
    findIncludes(code) {
        const includeRegex = /include\s+([a-zA-Z0-9_/<>]+)/gi;
        const matches = code.match(includeRegex) || [];
        return matches.map((match) => match.replace(/include\s+/i, '').trim());
    }
    findClasses(code) {
        const classRegex = /class\s+([a-zA-Z0-9_]+)\s+(definition|implementation)/gi;
        const classes = [];
        let match = classRegex.exec(code);
        while (match !== null) {
            classes.push({
                name: match[1],
                type: match[2].toLowerCase(),
                position: match.index,
            });
            match = classRegex.exec(code);
        }
        return classes;
    }
    findMethods(code) {
        const methodRegex = /methods?\s+([a-zA-Z0-9_]+)/gi;
        const methods = [];
        let match = methodRegex.exec(code);
        while (match !== null) {
            methods.push({
                name: match[1],
                position: match.index,
            });
            match = methodRegex.exec(code);
        }
        return methods;
    }
    findDataDeclarations(code) {
        const dataRegex = /data:?\s+([a-zA-Z0-9_]+)/gi;
        const declarations = [];
        let match = dataRegex.exec(code);
        while (match !== null) {
            declarations.push({
                name: match[1],
                position: match.index,
            });
            match = dataRegex.exec(code);
        }
        return declarations;
    }
    findForms(code) {
        const formRegex = /form\s+([a-zA-Z0-9_]+)/gi;
        const forms = [];
        let match = formRegex.exec(code);
        while (match !== null) {
            forms.push({
                name: match[1],
                position: match.index,
            });
            match = formRegex.exec(code);
        }
        return forms;
    }
}
async function handleGetAbapAST(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.code) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'ABAP code is required');
        }
        const astGenerator = new SimpleAbapASTGenerator();
        const ast = astGenerator.parseToAST(args.code);
        logger?.debug('Generated AST for provided ABAP code');
        const result = {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(ast, null, 2),
                },
            ],
        };
        if (args.filePath) {
            logger?.debug(`Writing AST result to file: ${args.filePath}`);
            (0, writeResultToFile_1.writeResultToFile)(JSON.stringify(ast, null, 2), args.filePath);
        }
        return result;
    }
    catch (error) {
        logger?.error('Failed to generate ABAP AST', error);
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
//# sourceMappingURL=handleGetAbapAST.js.map