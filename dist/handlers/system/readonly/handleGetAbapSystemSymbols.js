"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetAbapSystemSymbols = handleGetAbapSystemSymbols;
const utils_1 = require("../../../lib/utils");
const writeResultToFile_1 = require("../../../lib/writeResultToFile");
const handleGetClass_1 = require("../../class/high/handleGetClass");
const handleGetFunctionModule_1 = require("../../function_module/high/handleGetFunctionModule");
const handleGetInterface_1 = require("../../interface/high/handleGetInterface");
exports.TOOL_DEFINITION = {
    name: 'GetAbapSystemSymbols',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Resolve ABAP symbols from semantic analysis with SAP system information including types, scopes, descriptions, and packages.',
    inputSchema: {
        type: 'object',
        properties: {
            code: {
                type: 'string',
                description: 'ABAP source code to analyze and resolve symbols for',
            },
            filePath: {
                type: 'string',
                description: 'Optional file path to write the result to',
            },
        },
        required: ['code'],
    },
};
// Import semantic analyzer from the previous handler
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
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;
            if (line === '' || line.startsWith('*') || line.startsWith('"')) {
                continue;
            }
            try {
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
            this.pushScope(interfaceName, 'class', lineNumber);
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
            endLine: startLine,
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
class AbapSystemSymbolResolver {
    async resolveSymbols(context, symbols) {
        const resolvedSymbols = [];
        let resolvedCount = 0;
        let failedCount = 0;
        for (const symbol of symbols) {
            try {
                const resolved = await this.resolveSymbol(context, symbol);
                resolvedSymbols.push(resolved);
                if (resolved.systemInfo?.exists) {
                    resolvedCount++;
                }
                else {
                    failedCount++;
                }
            }
            catch (error) {
                // If resolution fails, add original symbol with error info
                resolvedSymbols.push({
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
                failedCount++;
            }
        }
        const stats = {
            totalSymbols: symbols.length,
            resolvedSymbols: resolvedCount,
            failedSymbols: failedCount,
            resolutionRate: `${((resolvedCount / symbols.length) * 100).toFixed(1)}%`,
        };
        return { resolvedSymbols, stats };
    }
    async resolveSymbol(context, symbol) {
        try {
            switch (symbol.type) {
                case 'class':
                    return await this.resolveClassSymbol(context, symbol);
                case 'function':
                    return await this.resolveFunctionSymbol(context, symbol);
                case 'interface':
                    return await this.resolveInterfaceSymbol(context, symbol);
                default:
                    return await this.resolveGenericSymbol(context, symbol);
            }
        }
        catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    async resolveClassSymbol(context, symbol) {
        const { connection, logger } = context;
        try {
            const classInfo = await (0, handleGetClass_1.handleGetClass)(context, {
                class_name: symbol.name,
            });
            if (!classInfo ||
                classInfo.isError ||
                !classInfo.content ||
                classInfo.content.length === 0) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Class not found in SAP system',
                    },
                };
            }
            const contentItem = classInfo.content[0];
            if (!contentItem) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Invalid response format from GetClass',
                    },
                };
            }
            // Parse JSON from text field (handleGetClass returns text with JSON string)
            let classData = {};
            if ('json' in contentItem) {
                classData = contentItem.json;
            }
            else if ('text' in contentItem && contentItem.text) {
                try {
                    classData = JSON.parse(contentItem.text);
                }
                catch {
                    // If parsing fails, use empty object
                }
            }
            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'CLAS',
                    description: classData?.description || `ABAP Class ${symbol.name}`,
                    package: classData?.packageName || 'Unknown',
                    superClass: classData?.superclass || '',
                },
            };
        }
        catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    async resolveFunctionSymbol(context, symbol) {
        try {
            const functionInfo = await (0, handleGetFunctionModule_1.handleGetFunctionModule)(context, {
                function_module_name: symbol.name,
                function_group_name: '',
            });
            if (!functionInfo ||
                functionInfo.isError ||
                !functionInfo.content ||
                functionInfo.content.length === 0) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Function not found in SAP system',
                    },
                };
            }
            const contentItem = functionInfo.content[0];
            if (!contentItem || !('json' in contentItem)) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Invalid response format from GetFunction',
                    },
                };
            }
            const functionData = contentItem.json;
            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'FUNC',
                    description: functionData?.description || `ABAP Function ${symbol.name}`,
                    package: functionData?.packageName || 'Unknown',
                    techName: functionData?.functionModuleName || '',
                },
            };
        }
        catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    async resolveInterfaceSymbol(context, symbol) {
        try {
            const interfaceInfo = await (0, handleGetInterface_1.handleGetInterface)(context, {
                interface_name: symbol.name,
            });
            if (!interfaceInfo ||
                interfaceInfo.isError ||
                !interfaceInfo.content ||
                interfaceInfo.content.length === 0) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Interface not found in SAP system',
                    },
                };
            }
            const contentItem = interfaceInfo.content[0];
            if (!contentItem) {
                return {
                    ...symbol,
                    systemInfo: {
                        exists: false,
                        error: 'Invalid response format from GetInterface',
                    },
                };
            }
            // Parse JSON from text field (handleGetInterface returns text with JSON string)
            let interfaceData = {};
            if ('json' in contentItem) {
                interfaceData = contentItem.json;
            }
            else if ('text' in contentItem && contentItem.text) {
                try {
                    interfaceData = JSON.parse(contentItem.text);
                }
                catch {
                    // If parsing fails, use empty object
                }
            }
            return {
                ...symbol,
                systemInfo: {
                    exists: true,
                    objectType: 'INTF',
                    description: interfaceData?.description || `ABAP Interface ${symbol.name}`,
                    package: interfaceData?.packageName || 'Unknown',
                },
            };
        }
        catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    async resolveGenericSymbol(_context, symbol) {
        try {
            // For generic symbols, we don't have a specific handler
            // Return symbol with basic system info indicating it exists locally
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    objectType: 'LOCAL',
                    description: `Local ${symbol.type} ${symbol.name}`,
                    package: 'LOCAL',
                    error: 'No system resolution available for this symbol type',
                },
            };
        }
        catch (error) {
            return {
                ...symbol,
                systemInfo: {
                    exists: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
}
async function handleGetAbapSystemSymbols(context, args) {
    const { logger } = context;
    try {
        if (!args?.code) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'ABAP code is required');
        }
        logger?.debug('Running semantic analysis and system symbol resolution');
        // First, perform semantic analysis
        const analyzer = new SimpleAbapSemanticAnalyzer();
        const semanticResult = analyzer.analyze(args.code);
        // Then, resolve symbols with SAP system information
        const resolver = new AbapSystemSymbolResolver();
        const { resolvedSymbols, stats } = await resolver.resolveSymbols(context, semanticResult.symbols);
        logger?.info(`Resolved ${stats.resolvedSymbols}/${stats.totalSymbols} symbols from system`);
        const result = {
            symbols: resolvedSymbols,
            dependencies: semanticResult.dependencies,
            errors: semanticResult.errors,
            scopes: semanticResult.scopes,
            systemResolutionStats: stats,
        };
        const response = {
            isError: false,
            content: [
                {
                    type: 'json',
                    json: result,
                },
            ],
        };
        if (args.filePath) {
            logger?.debug(`Writing system symbol resolution result to file: ${args.filePath}`);
            (0, writeResultToFile_1.writeResultToFile)(JSON.stringify(result, null, 2), args.filePath);
        }
        return response;
    }
    catch (error) {
        logger?.error('Failed to resolve ABAP system symbols', error);
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
//# sourceMappingURL=handleGetAbapSystemSymbols.js.map