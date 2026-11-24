"use strict";
/**
 * ECC branch of CreateTable.
 *
 * ECC (BASIS < 7.50) has no ADT DDIC table endpoint and its DDIC write
 * layer is row-based (DD02V header + DD03P fields + DD09L technical
 * settings), not CDS-DDL source. This branch turns the tool's `fields`
 * (and `includes`) into those rows, sends them to the server FM
 * ZMCP_ADT_DDIC_TABL (OData FunctionImport DdicTabl) and activates
 * through ZMCP_ADT_DDIC_ACTIVATE. Field shape matches CreateStructure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEccTablePayload = buildEccTablePayload;
exports.handleCreateTableEcc = handleCreateTableEcc;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
/** Default DDIC lengths of built-in types that need no explicit length. */
const ECC_FIXED_LENGTHS = {
    DATS: 8,
    TIMS: 6,
    INT1: 3,
    INT2: 5,
    INT4: 10,
    INT8: 19,
    CLNT: 3,
    LANG: 1,
};
const FIELD_RE = /^[A-Z][A-Z0-9_]{0,15}$/;
const OBJ_RE = /^[A-Z/][A-Z0-9_/]{0,29}$/;
const pad4 = (n) => String(n).padStart(4, '0');
const pad6 = (n) => String(n).padStart(6, '0');
/** Builds the DdicTabl JSON payload (DD02V + DD03P + DD09L). Exported for unit tests. */
function buildEccTablePayload(args, tableName) {
    const fields = args.fields ?? [];
    if (fields.length === 0) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'CreateTable on ECC needs "fields" (name, key, data_element or data_type + length, ' +
            'reference_field for QUAN / CURR). ECC has no DDL source to set later.');
    }
    if (!fields[0].key) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'The first field must be a key field (MANDT for a client-dependent table).');
    }
    const seen = new Set();
    const dd03p = fields.map((field, index) => {
        const fieldName = (field.name ?? '').toUpperCase();
        if (!FIELD_RE.test(fieldName)) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Invalid field name "${field.name}" (A-Z, 0-9, _; max 16 characters).`);
        }
        if (seen.has(fieldName)) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Duplicate field ${fieldName}.`);
        }
        seen.add(fieldName);
        if (field.key && index > 0 && !fields[index - 1].key) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Key field ${fieldName} must come before all non-key fields.`);
        }
        const row = {
            TABNAME: tableName,
            FIELDNAME: fieldName,
            POSITION: pad4(index + 1),
            DDLANGUAGE: 'E',
        };
        if (field.key)
            row.KEYFLAG = 'X';
        if (field.key || field.not_null)
            row.NOTNULL = 'X';
        if (field.data_element) {
            row.ROLLNAME = field.data_element.toUpperCase();
            row.COMPTYPE = 'E';
        }
        else if (field.data_type) {
            const dataType = field.data_type.toUpperCase();
            const length = field.length ?? ECC_FIXED_LENGTHS[dataType];
            if (!length) {
                throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${fieldName}: data_type ${dataType} needs a length.`);
            }
            row.DATATYPE = dataType;
            row.LENG = pad6(length);
            row.DECIMALS = pad6(field.decimals ?? 0);
            if (field.description)
                row.DDTEXT = field.description.slice(0, 60);
        }
        else {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${fieldName}: give data_element or data_type (+ length).`);
        }
        if (field.reference_field) {
            row.REFTABLE = (field.reference_table || tableName).toUpperCase();
            row.REFFIELD = field.reference_field.toUpperCase();
        }
        return row;
    });
    for (const inc of args.includes ?? []) {
        const incName = (inc?.name ?? '').toUpperCase();
        if (!OBJ_RE.test(incName)) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Invalid include name "${inc?.name}".`);
        }
        dd03p.push({
            TABNAME: tableName,
            FIELDNAME: '.INCLUDE',
            POSITION: pad4(dd03p.length + 1),
            DDLANGUAGE: 'E',
            PRECFIELD: incName,
            COMPTYPE: 'S',
            DATATYPE: 'STRU',
            MASK: '      S',
        });
    }
    // A reference_field must name a field of this table when it points here.
    for (const row of dd03p) {
        if (row.REFTABLE === tableName && !seen.has(row.REFFIELD)) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Field ${row.FIELDNAME}: reference_field ${row.REFFIELD} is not a field of ${tableName}.`);
        }
    }
    const dd02v = {
        TABNAME: tableName,
        DDLANGUAGE: 'E',
        TABCLASS: 'TRANSP',
        DDTEXT: (args.description || tableName).slice(0, 60),
        MASTERLANG: 'E',
        CONTFLAG: (args.delivery_class || 'A').toUpperCase(),
        MAINFLAG: 'X',
        // Enhancement category: 1 cannot be enhanced, 2 character-like,
        // 3 character-like or numeric, 4 deep. A table with .INCLUDE rows
        // does not activate as 1, so it defaults to 4 there.
        EXCLASS: args.enhancement_category ||
            ((args.includes ?? []).length > 0 ? '4' : '1'),
    };
    if (!/^[1-4]$/.test(dd02v.EXCLASS)) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `enhancement_category must be 1, 2, 3 or 4 (got "${dd02v.EXCLASS}").`);
    }
    if (fields[0].data_element?.toUpperCase() === 'MANDT')
        dd02v.CLIDEP = 'X';
    const dd09l = {
        TABNAME: tableName,
        AS4LOCAL: 'A',
        TABART: (args.data_class || 'APPL1').toUpperCase(),
        TABKAT: args.size_category ?? '0',
        BUFALLOW: 'N',
    };
    return { dd02v, dd03p, dd09l };
}
async function handleCreateTableEcc(context, args) {
    const { connection, logger } = context;
    const tableName = args.table_name.toUpperCase();
    const payload = buildEccTablePayload(args, tableName);
    if (args.package_name.toUpperCase() !== '$TMP' && !args.transport_request) {
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `CreateTable on ECC: package ${args.package_name} is transportable — pass transport_request.`);
    }
    const shouldActivate = args.activate !== false;
    try {
        logger?.info(`ECC: creating table ${tableName} via ZMCP_ADT_DDIC_TABL`);
        await (0, rfcBackend_1.callDdicTabl)(connection, 'CREATE', {
            name: tableName,
            devclass: args.package_name,
            transport: args.transport_request,
            payload_json: JSON.stringify(payload),
        });
        let warn = '';
        if (shouldActivate) {
            const actRes = await (0, rfcBackend_1.callDdicActivate)(connection, 'TABL', tableName);
            if (actRes.subrc !== 0)
                warn = ` (activation rc=${actRes.subrc}: ${actRes.message})`;
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                table_name: tableName,
                package: args.package_name,
                transport_request: args.transport_request,
                field_count: payload.dd03p.length,
                status: shouldActivate ? 'active' : 'inactive',
                message: `Table ${tableName} created${shouldActivate ? ` and activated${warn}` : ' (inactive)'} (ECC fallback via ${(0, rfcBackend_1.eccBridgeVia)()})`,
                path: (0, rfcBackend_1.eccBridgePath)(),
            }, null, 2),
        });
    }
    catch (error) {
        logger?.error(`ECC CreateTable error for ${tableName}: ${error?.message || error}`);
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, `Failed to create table ${tableName} (ECC fallback): ${error?.message || String(error)}`);
    }
}
//# sourceMappingURL=handleCreateTableEcc.js.map