"use strict";
/**
 * WhereUsed handler using AdtClient utilities
 * Endpoint: /sap/bc/adt/repository/informationsystem/usageReferences
 * Uses getWhereUsedList for parsed results
 *
 * On legacy systems (BASIS < 7.50) createAdtClient() returns AdtClientLegacy,
 * whose utils skip the scope step and address DDIC objects through VIT URIs
 * (client library >= 3.15.0). The handler itself does not branch on ECC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = exports.SUPPORTED_WHERE_USED_TYPES = void 0;
exports.isCustomerReference = isCustomerReference;
exports.matchesPackage = matchesPackage;
exports.applyWhereUsedFilters = applyWhereUsedFilters;
exports.whereUsedErrorHint = whereUsedErrorHint;
exports.handleGetWhereUsed = handleGetWhereUsed;
const clients_1 = require("../../../lib/clients");
const getObjectsListCache_1 = require("../../../lib/getObjectsListCache");
const utils_1 = require("../../../lib/utils");
exports.SUPPORTED_WHERE_USED_TYPES = 'class, interface, program, include, functiongroup, function_module, table, structure, dataelement, domain, view, tabletype (ECC), transaction (ECC), messageclass (ECC), package';
exports.TOOL_DEFINITION = {
    name: 'GetWhereUsed',
    available_in: ['onprem', 'cloud', 'legacy'],
    description: '[read-only] Find where-used references (cross-references, usages, dependencies) for ABAP objects — classes, interfaces, tables, data elements, programs, function modules, etc. Returns list of all referencing objects with their types and packages. On ECC a function module may be given by plain name (no GROUP|FM needed). Widely used SAP standard tables (e.g. VBAK) can take about 60 s and return thousands of references — use customer_only / package / max_results to shrink the answer (filtering happens after the SAP search, so it does not shorten the search time). Pass references[].object_identifier to GetUsageSnippets for line-level hits.',
    inputSchema: {
        type: 'object',
        properties: {
            object_name: {
                type: 'string',
                description: 'Name of the ABAP object',
            },
            object_type: {
                type: 'string',
                description: `Type of the ABAP object: ${exports.SUPPORTED_WHERE_USED_TYPES}`,
            },
            enable_all_types: {
                type: 'boolean',
                description: "If true, searches in all available object types (Eclipse 'select all' behavior). Default: false (uses SAP default scope). Ignored on ECC (no scope resource).",
                default: false,
            },
            max_results: {
                type: 'number',
                description: 'Optional cap on references[] after filtering. Omit or 0 = no cap. truncated=true when more were found.',
            },
            customer_only: {
                type: 'boolean',
                description: 'Optional. Keep only customer objects: name starting with Z / Y, or package Z* / Y* / $*. Objects in /namespace/ (SAP industry solutions, partners, generated /1.../) are dropped; for a registered customer namespace use package: "/ACME/*" instead. Default: false.',
                default: false,
            },
            package: {
                type: 'string',
                description: 'Optional package filter on references[].package_name: exact name, or prefix with a trailing * (e.g. ZSD*).',
            },
            timeout_ms: {
                type: 'number',
                description: 'Optional request timeout in ms for the SAP search. Default: SAP_TIMEOUT_LONG (120 s) on ECC, SAP_TIMEOUT_DEFAULT (45 s) otherwise.',
            },
        },
        required: ['object_name', 'object_type'],
    },
};
/**
 * Customer namespace check used by customer_only: Z / Y object name, or Z / Y / $ package.
 * Names in a /namespace/ are not treated as customer objects: on ECC they are mostly SAP
 * industry solutions, partner add-ons or generated objects (/1BCDWB/ SmartForm modules).
 */
function isCustomerReference(ref) {
    const name = (ref.name || '').toUpperCase();
    const pkg = (ref.package_name || '').toUpperCase();
    if (/^[ZY]/.test(name))
        return true;
    if (/^[ZY$]/.test(pkg))
        return true;
    return false;
}
/** Package filter: exact (case-insensitive) or prefix with trailing '*'. */
function matchesPackage(packageName, pattern) {
    const pkg = (packageName || '').toUpperCase();
    const p = pattern.trim().toUpperCase();
    if (p === '' || p === '*')
        return true;
    if (p.endsWith('*'))
        return pkg.startsWith(p.slice(0, -1));
    return pkg === p;
}
/**
 * Apply the optional filters and cap. With no option set the input list is
 * returned unchanged (same order, same entries).
 */
function applyWhereUsedFilters(references, opts) {
    let refs = references;
    if (opts.customer_only)
        refs = refs.filter(isCustomerReference);
    if (opts.package?.trim()) {
        const pattern = opts.package;
        refs = refs.filter((r) => matchesPackage(r.package_name, pattern));
    }
    const filtered_out = references.length - refs.length;
    const max = typeof opts.max_results === 'number' && opts.max_results > 0
        ? Math.floor(opts.max_results)
        : 0;
    const truncated = max > 0 && refs.length > max;
    if (truncated)
        refs = refs.slice(0, max);
    return { references: refs, filtered_out, truncated };
}
/** Add an actionable hint to well-known ADT where-used failures. */
function whereUsedErrorHint(error) {
    const e = error;
    const msg = `${e?.message ?? ''} ${typeof e?.response?.data === 'string' ? e.response.data : ''}`;
    if (/Error while converting object references/i.test(msg)) {
        return 'SAP could not resolve the object URI. On ECC / BASIS < 7.50, DDIC objects, transactions and function modules need the legacy path (workbench VIT URIs): make sure the profile sets SAP_VERSION=ECC or ABAP_RELEASE < 750. Also check that object_name exists and object_type is right.';
    }
    if (/Unsupported object type for where-used/i.test(msg)) {
        return `Supported object_type values: ${exports.SUPPORTED_WHERE_USED_TYPES}.`;
    }
    if (/GROUP\|FM_NAME/.test(msg)) {
        return 'On S/4HANA pass a function module as GROUP|FM_NAME (e.g. ZFG|Z_MY_FM).';
    }
    if (e?.code === 'ECONNABORTED' ||
        e?.code === 'ETIMEDOUT' ||
        /timeout of \d+ms exceeded|timed? ?out/i.test(msg)) {
        return 'The search timed out. The object is probably referenced very widely (e.g. VBAK). Raise timeout_ms (or SAP_TIMEOUT_LONG); customer_only / package / max_results only shrink the answer, not the SAP search time.';
    }
    if (e?.response?.status === 404 || /status code 404/.test(msg)) {
        return 'The object or the where-used resource was not found. Check object_name / object_type.';
    }
    return undefined;
}
/**
 * Returns where-used references for ABAP objects using AdtClient utilities.
 * Uses getWhereUsedList for parsed structured results.
 */
async function handleGetWhereUsed(context, args) {
    const { connection, logger } = context;
    try {
        // Validate required parameters
        if (!args?.object_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Object name is required');
        }
        if (!args?.object_type) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Object type is required');
        }
        const typedArgs = args;
        logger?.info(`Resolving where-used list for ${typedArgs.object_type}/${typedArgs.object_name}`);
        // Create AdtClient and get utilities
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const utils = client.getUtils();
        const timeoutMs = typeof typedArgs.timeout_ms === 'number' && typedArgs.timeout_ms > 0
            ? Math.floor(typedArgs.timeout_ms)
            : undefined;
        // Use getWhereUsedList for parsed results
        const result = await utils.getWhereUsedList({
            object_name: typedArgs.object_name,
            object_type: typedArgs.object_type,
            enableAllTypes: typedArgs.enable_all_types,
            ...(timeoutMs ? { timeoutMs } : {}),
        });
        logger?.debug(`Where-used search completed for ${typedArgs.object_type}/${typedArgs.object_name}: ${result.totalReferences} references`);
        const allReferences = result.references.map((ref) => ({
            name: ref.name,
            type: ref.type,
            uri: ref.uri,
            package_name: ref.packageName,
            responsible: ref.responsible,
            usage_information: ref.usageInformation,
            object_identifier: ref.objectIdentifier,
        }));
        const filtered = applyWhereUsedFilters(allReferences, typedArgs);
        // Format response with parsed data (new fields are additive)
        const formattedResponse = {
            object_name: result.objectName,
            object_type: result.objectType,
            enable_all_types: typedArgs.enable_all_types || false,
            total_references: result.totalReferences,
            result_description: result.resultDescription,
            references: filtered.references,
            returned_references: filtered.references.length,
            truncated: filtered.truncated,
            filtered_out: filtered.filtered_out,
            notes: result.notes ?? [],
        };
        const mcpResult = {
            isError: false,
            content: [
                {
                    type: 'json',
                    json: formattedResponse,
                },
            ],
        };
        getObjectsListCache_1.objectsListCache.setCache(mcpResult);
        return mcpResult;
    }
    catch (error) {
        logger?.error('Failed to resolve where-used references', error);
        const hint = whereUsedErrorHint(error);
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `ADT error: ${String(error)}${hint ? `\nHint: ${hint}` : ''}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetWhereUsed.js.map