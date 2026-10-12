"use strict";
/**
 * GetUsageSnippets handler — line-level where-used hits
 * Endpoint: POST /sap/bc/adt/repository/informationsystem/usageSnippets
 *
 * Input is either the object_identifier values returned by GetWhereUsed, or an
 * object (object_name + object_type) for which the where-used search runs first.
 * Requires @babamba2/mcp-abap-adt-clients >= 3.15.0 (getUsageSnippets).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = exports.SNIPPET_BATCH_SIZE = void 0;
exports.chunk = chunk;
exports.handleGetUsageSnippets = handleGetUsageSnippets;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
const handleGetWhereUsed_1 = require("./handleGetWhereUsed");
/** Identifiers per usageSnippets POST. Keeps single requests small on large where-used results. */
exports.SNIPPET_BATCH_SIZE = 50;
const DEFAULT_MAX_OBJECTS = 200;
exports.TOOL_DEFINITION = {
    name: 'GetUsageSnippets',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Line-level where-used hits: for each referencing object, the source lines that use the searched object, with uri ".../source/main#start=<line>,<col>", line, column and the source line. Pass object_identifiers from GetWhereUsed references[].object_identifier, or object_name + object_type to run the where-used search first (customer_only / package filters apply to that search). Works on ECC 7.40 and S/4HANA.',
    inputSchema: {
        type: 'object',
        properties: {
            object_identifiers: {
                type: 'array',
                items: { type: 'string' },
                description: 'object_identifier values from GetWhereUsed references[]. Takes precedence over object_name / object_type.',
            },
            object_name: {
                type: 'string',
                description: 'Object to search (used when object_identifiers is not given).',
            },
            object_type: {
                type: 'string',
                description: `Object type for object_name: ${handleGetWhereUsed_1.SUPPORTED_WHERE_USED_TYPES}`,
            },
            customer_only: {
                type: 'boolean',
                description: 'With object_name: only customer referencing objects (Z / Y name, or package Z* / Y* / $*). Default: false.',
                default: false,
            },
            package: {
                type: 'string',
                description: 'With object_name: package filter on the referencing objects (exact, or prefix with trailing *).',
            },
            max_objects: {
                type: 'number',
                description: `Cap on referencing objects whose snippets are fetched. Default: ${DEFAULT_MAX_OBJECTS}. truncated=true when more were available.`,
            },
            include_context: {
                type: 'boolean',
                description: 'Include the multi-line context SAP returns per hit (description). Default: false.',
                default: false,
            },
            timeout_ms: {
                type: 'number',
                description: 'Optional request timeout in ms per SAP request (the where-used search and each snippet batch).',
            },
        },
        required: [],
    },
};
/** Split a list into chunks of `size`. */
function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}
async function handleGetUsageSnippets(context, args) {
    const { connection, logger } = context;
    try {
        const timeoutMs = typeof args?.timeout_ms === 'number' && args.timeout_ms > 0
            ? Math.floor(args.timeout_ms)
            : undefined;
        const maxObjects = typeof args?.max_objects === 'number' && args.max_objects > 0
            ? Math.floor(args.max_objects)
            : DEFAULT_MAX_OBJECTS;
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        if (typeof utils.getUsageSnippets !== 'function') {
            throw new Error('GetUsageSnippets needs @babamba2/mcp-abap-adt-clients >= 3.15.0 (getUsageSnippets is missing).');
        }
        // Referencing object (name/type/package) per identifier, when known.
        const meta = new Map();
        let identifiers = [];
        let source = 'object_identifiers';
        const notes = [];
        if (Array.isArray(args?.object_identifiers)) {
            identifiers = args.object_identifiers.filter((id) => typeof id === 'string' && id.trim() !== '');
        }
        if (identifiers.length === 0) {
            if (!args?.object_name || !args?.object_type) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Pass object_identifiers (from GetWhereUsed references[].object_identifier) or object_name + object_type.');
            }
            source = 'where_used';
            const wu = await utils.getWhereUsedList({
                object_name: args.object_name,
                object_type: args.object_type,
                ...(timeoutMs ? { timeoutMs } : {}),
            });
            if (Array.isArray(wu.notes))
                notes.push(...wu.notes);
            const refs = wu.references
                .filter((r) => r.objectIdentifier)
                .map((r) => ({
                name: r.name,
                type: r.type,
                uri: r.uri,
                package_name: r.packageName,
                object_identifier: r.objectIdentifier,
            }));
            const filtered = (0, handleGetWhereUsed_1.applyWhereUsedFilters)(refs, {
                customer_only: args.customer_only,
                package: args.package,
            });
            if (filtered.filtered_out > 0) {
                notes.push(`${filtered.filtered_out} referencing objects removed by customer_only / package`);
            }
            for (const r of filtered.references) {
                meta.set(r.object_identifier, r);
            }
            identifiers = filtered.references.map((r) => r.object_identifier);
        }
        // De-duplicate, keep order
        identifiers = [...new Set(identifiers)];
        const available = identifiers.length;
        const truncated = available > maxObjects;
        if (truncated)
            identifiers = identifiers.slice(0, maxObjects);
        const objects = [];
        let totalSnippets = 0;
        for (const batch of chunk(identifiers, exports.SNIPPET_BATCH_SIZE)) {
            const res = await utils.getUsageSnippets({
                objectIdentifiers: batch,
                ...(timeoutMs ? { timeoutMs } : {}),
            });
            for (const o of res.objects) {
                const m = meta.get(o.objectIdentifier);
                totalSnippets += o.snippets.length;
                objects.push({
                    object_identifier: o.objectIdentifier,
                    ...(m
                        ? {
                            name: m.name,
                            type: m.type,
                            package_name: m.package_name,
                        }
                        : {}),
                    snippets: o.snippets.map((s) => ({
                        uri: s.uri,
                        source_uri: s.sourceUri,
                        line: s.line,
                        column: s.column,
                        content: s.content,
                        matches: s.matches,
                        ...(args?.include_context && s.description
                            ? { context: s.description }
                            : {}),
                    })),
                });
            }
        }
        return {
            isError: false,
            content: [
                {
                    type: 'json',
                    json: {
                        source,
                        ...(source === 'where_used'
                            ? { object_name: args.object_name, object_type: args.object_type }
                            : {}),
                        requested_objects: identifiers.length,
                        available_objects: available,
                        truncated,
                        returned_objects: objects.length,
                        total_snippets: totalSnippets,
                        objects,
                        notes,
                    },
                },
            ],
        };
    }
    catch (error) {
        logger?.error('Failed to read usage snippets', error);
        const hint = (0, handleGetWhereUsed_1.whereUsedErrorHint)(error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `ADT error: ${error instanceof Error ? error.message : String(error)}${hint ? `\nHint: ${hint}` : ''}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetUsageSnippets.js.map