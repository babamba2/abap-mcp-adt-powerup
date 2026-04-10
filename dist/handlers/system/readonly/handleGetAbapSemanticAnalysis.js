"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetAbapSemanticAnalysis = handleGetAbapSemanticAnalysis;
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
exports.TOOL_DEFINITION = {
    name: 'GetAbapSemanticAnalysis',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Perform semantic analysis on ABAP code and return symbols, types, scopes, and dependencies.',
    inputSchema: {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: 'ABAP source code to analyze',
            },
            filePath: {
                type: 'string',
                description: 'Optional file path to write the result to',
            },
        },
        required: ['code'],
    },
};
// Simplified semantic analyzer that doesn't depend on ANTLR until it's properly set up
class SimpleAbapSemanticAnalyzer {
    symbols = [];
    scopes = [];
    dependencies = [];
    errors = [];
    currentScope = 'global';
    analyze(code) {
        // Reset state
        this.symbols = [];
        this.scopes = [];
        this.dependencies = [];
        this.errors = [];
        this.currentScope = 'global';
        try {
            this.analyzeCode(code);
        }
        catch (error) {
            this.errors.push({
                message: error instanceof Error ? error.message : String(error),
                line: 1,
                column: 1,
                severity: 'error',
            });
        }
        return {
            symbols: this.symbols,
            dependencies: this.dependencies,
            errors: this.errors,
            scopes: this.scopes,
        };
    }
    analyzeCode(code) {
        const lines = code.split('\n');
        const _currentClassScope = null;
        const _currentMethodScope = null;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;
            if (line === '' || line.startsWith('*') || line.startsWith('"')) {
                continue; // Skip empty lines and comments
            }
            try {
                // Analyze different ABAP constructs
                this.analyzeClassDefinition(line, lineNumber);
                this.analyzeClassImplementation(line, lineNumber);
                this.analyzeMethodDefinition(line, lineNumber);
                this.analyzeMethodImplementation(line, lineNumber);
                this.analyzeDataDeclaration(line, lineNumber);
                this.analyzeConstantsDeclaration(line, lineNumber);
                this.analyzeTypesDeclaration(line, lineNumber);
                this.analyzeFormDefinition(line, lineNumber);
                this.analyzeFunctionDefinition(line, lineNumber);
                this.analyzeIncludeStatement(line, lineNumber);
                this.analyzeInterfaceDefinition(line, lineNumber);
                this.analyzeScopeEnders(line, lineNumber);
            }
            catch (error) {
                this.errors.push({
                    message: `Error analyzing line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`,
                    line: lineNumber,
                    column: 1,
                    severity: 'warning',
                });
            }
        }
    }
    analyzeClassDefinition(line, lineNumber) {
        const classDefMatch = line
            .toLowerCase()
            .match(/^class\s+([a-zA-Z0-9_]+)\s+definition/);
        if (classDefMatch) {
            const className = classDefMatch[1].toUpperCase();
            this.addSymbol({
                name: className,
                type: 'class',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line),
            });
            this.pushScope(className, 'class', lineNumber);
        }
    }
    analyzeClassImplementation(line, lineNumber) {
        const classImplMatch = line
            .toLowerCase()
            .match(/^class\s+([a-zA-Z0-9_]+)\s+implementation/);
        if (classImplMatch) {
            const className = classImplMatch[1].toUpperCase();
            this.pushScope(`${className}_IMPL`, 'class', lineNumber);
        }
    }
    analyzeMethodDefinition(line, lineNumber) {
        const methodMatch = line
            .toLowerCase()
            .match(/^(methods|class-methods)\s+([a-zA-Z0-9_]+)/);
        if (methodMatch) {
            const methodName = methodMatch[2].toUpperCase();
            const isStatic = methodMatch[1] === 'class-methods';
            this.addSymbol({
                name: methodName,
                type: 'method',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line),
                description: isStatic ? 'Static method' : 'Instance method',
                parameters: this.extractMethodParameters(line),
            });
        }
    }
    analyzeMethodImplementation(line, lineNumber) {
        const methodImplMatch = line
            .toLowerCase()
            .match(/^method\s+([a-zA-Z0-9_~\->]+)/);
        if (methodImplMatch) {
            const methodName = methodImplMatch[1].toUpperCase();
            this.pushScope(methodName, 'method', lineNumber);
        }
    }
    analyzeDataDeclaration(line, lineNumber) {
        const dataMatches = [
            line.toLowerCase().match(/^data:?\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/^class-data:?\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/^statics:?\s+([a-zA-Z0-9_]+)/),
        ];
        for (const match of dataMatches) {
            if (match) {
                const varName = match[1].toUpperCase();
                this.addSymbol({
                    name: varName,
                    type: 'variable',
                    scope: this.currentScope,
                    line: lineNumber,
                    column: 1,
                    dataType: this.extractDataType(line),
                    visibility: this.extractVisibility(line),
                });
                break;
            }
        }
    }
    analyzeConstantsDeclaration(line, lineNumber) {
        const constantMatch = line
            .toLowerCase()
            .match(/^constants:?\s+([a-zA-Z0-9_]+)/);
        if (constantMatch) {
            const constName = constantMatch[1].toUpperCase();
            this.addSymbol({
                name: constName,
                type: 'constant',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                dataType: this.extractDataType(line),
                visibility: this.extractVisibility(line),
            });
        }
    }
    analyzeTypesDeclaration(line, lineNumber) {
        const typeMatch = line.toLowerCase().match(/^types:?\s+([a-zA-Z0-9_]+)/);
        if (typeMatch) {
            const typeName = typeMatch[1].toUpperCase();
            this.addSymbol({
                name: typeName,
                type: 'type',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                dataType: this.extractDataType(line),
                visibility: this.extractVisibility(line),
            });
        }
    }
    analyzeFormDefinition(line, lineNumber) {
        const formMatch = line.toLowerCase().match(/^form\s+([a-zA-Z0-9_]+)/);
        if (formMatch) {
            const formName = formMatch[1].toUpperCase();
            this.addSymbol({
                name: formName,
                type: 'form',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
            });
            this.pushScope(formName, 'form', lineNumber);
        }
    }
    analyzeFunctionDefinition(line, lineNumber) {
        const functionMatch = line
            .toLowerCase()
            .match(/^function\s+([a-zA-Z0-9_]+)/);
        if (functionMatch) {
            const functionName = functionMatch[1].toUpperCase();
            this.addSymbol({
                name: functionName,
                type: 'function',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
            });
            this.pushScope(functionName, 'function', lineNumber);
        }
    }
    analyzeIncludeStatement(line, lineNumber) {
        const includeMatch = line
            .toLowerCase()
            .match(/^include\s+([a-zA-Z0-9_/<>]+)/);
        if (includeMatch) {
            const includeName = includeMatch[1].toUpperCase();
            this.dependencies.push(includeName);
            this.addSymbol({
                name: includeName,
                type: 'include',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
            });
        }
    }
    analyzeInterfaceDefinition(line, lineNumber) {
        const interfaceMatch = line
            .toLowerCase()
            .match(/^interface\s+([a-zA-Z0-9_]+)/);
        if (interfaceMatch) {
            const interfaceName = interfaceMatch[1].toUpperCase();
            this.addSymbol({
                name: interfaceName,
                type: 'interface',
                scope: this.currentScope,
                line: lineNumber,
                column: 1,
                visibility: this.extractVisibility(line),
            });
            this.pushScope(interfaceName, 'class', lineNumber); // Interface acts like class scope
        }
    }
    analyzeScopeEnders(line, lineNumber) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.match(/^(endclass|endmethod|endform|endfunction|endinterface)\.?$/)) {
            this.popScope(lineNumber);
        }
    }
    addSymbol(symbol) {
        this.symbols.push(symbol);
    }
    pushScope(name, type, startLine) {
        const scope = {
            name,
            type,
            startLine,
            endLine: startLine, // Will be updated when scope is popped
            parent: this.currentScope !== 'global' ? this.currentScope : undefined,
        };
        this.scopes.push(scope);
        this.currentScope = name;
    }
    popScope(endLine) {
        const currentScopeInfo = this.scopes.find((s) => s.name === this.currentScope);
        if (currentScopeInfo) {
            currentScopeInfo.endLine = endLine;
        }
        // Find parent scope
        const parentScope = this.scopes.find((s) => s.name === currentScopeInfo?.parent);
        this.currentScope = parentScope?.name || 'global';
    }
    extractVisibility(line) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('private'))
            return 'private';
        if (lowerLine.includes('protected'))
            return 'protected';
        return 'public';
    }
    extractDataType(line) {
        const typeMatches = [
            line.toLowerCase().match(/type\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/like\s+([a-zA-Z0-9_]+)/),
            line.toLowerCase().match(/type\s+ref\s+to\s+([a-zA-Z0-9_]+)/),
        ];
        for (const match of typeMatches) {
            if (match) {
                return match[1].toUpperCase();
            }
        }
        return undefined;
    }
    extractMethodParameters(line) {
        const parameters = [];
        // This is a simplified parameter extraction
        // In a real implementation, this would be more sophisticated
        const paramTypes = ['importing', 'exporting', 'changing', 'returning'];
        for (const paramType of paramTypes) {
            const regex = new RegExp(`${paramType}\\s+([a-zA-Z0-9_\\s,]+)`, 'gi');
            const match = regex.exec(line);
            if (match) {
                const paramNames = match[1].split(',').map((p) => p.trim());
                for (const paramName of paramNames) {
                    if (paramName) {
                        parameters.push({
                            name: paramName.toUpperCase(),
                            type: paramType,
                            optional: line.toLowerCase().includes('optional'),
                        });
                    }
                }
            }
        }
        return parameters;
    }
}
async function handleGetAbapSemanticAnalysis(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.code) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'ABAP code is required');
        }
        logger?.debug('Running semantic analysis for provided ABAP code');
        const analyzer = new SimpleAbapSemanticAnalyzer();
        const analysis = analyzer.analyze(args.code);
        const result = {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(analysis, null, 2),
                },
            ],
        };
        if (args.filePath) {
            logger?.debug(`Writing semantic analysis result to file: ${args.filePath}`);
            (0, writeResultToFile_1.writeResultToFile)(JSON.stringify(analysis, null, 2), args.filePath);
        }
        return result;
    }
    catch (error) {
        logger?.error('Failed to perform ABAP semantic analysis', error);
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
//# sourceMappingURL=handleGetAbapSemanticAnalysis.js.map