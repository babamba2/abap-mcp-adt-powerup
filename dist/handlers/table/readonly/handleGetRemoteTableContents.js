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
exports.readRemoteDestinations = readRemoteDestinations;
exports.rememberRemoteDestination = rememberRemoteDestination;
exports.splitWhereLines = splitWhereLines;
exports.dispatchErrorText = dispatchErrorText;
exports.handleGetRemoteTableContents = handleGetRemoteTableContents;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const z = __importStar(require("zod"));
const tableBlocklist_1 = require("../../../lib/policy/tableBlocklist");
const profile_1 = require("../../../lib/profile");
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
// Same cap as the ABAP REMOTE_READ action; larger extracts page with skip_rows.
const MAX_ROWS = 5000;
// Rows returned when max_rows is not given: enough to see the data shape without a large dump.
const DEFAULT_ROWS = 100;
// RFC_READ_TABLE takes the WHERE clause as OPTIONS lines of at most 72 characters.
const OPTION_WIDTH = 72;
// Saved destinations kept per profile; older ones drop off so the picker list stays short.
const DEST_KEEP = 10;
exports.TOOL_DEFINITION = {
    name: 'GetRemoteTableContents',
    available_in: ['onprem'],
    description: '[read-only; needs the REMOTE_READ action in ZMCP_ADT_DISPATCH] Read rows of one table in another ' +
        'SAP system through an SM59 RFC destination (ABAP connection) with RFC_READ_TABLE, for building ' +
        'realistic test data. Never guess the destination: when the user has not named one, call without ' +
        'it — the error lists the destinations saved for this profile — and let the user pick one of them ' +
        'or enter another. A destination is saved after its first successful read. Business tables are ' +
        'allowed; the table blocklist still applies. One table per call (no joins); a row longer than 512 ' +
        'characters fails, so pick fields. Filter on key / indexed fields (large tables time out otherwise) ' +
        'and page large extracts with skip_rows.',
    inputSchema: {
        table_name: z.string().describe('Table in the remote system, e.g. VBAK.'),
        fields: z
            .array(z.string())
            .optional()
            .describe('Fields to read; all fields when omitted (fails above 512 characters per row).'),
        where: z
            .string()
            .optional()
            .describe("Open SQL condition without WHERE, e.g. VKORG = '1000'. No sub-queries."),
        max_rows: z
            .number()
            .optional()
            .describe(`Rows to return (default ${DEFAULT_ROWS}, max ${MAX_ROWS}).`),
        skip_rows: z
            .number()
            .optional()
            .describe('Rows to skip first, for paging (default 0).'),
        destination: z
            .string()
            .optional()
            .describe('SM59 RFC destination (ABAP connection, case-sensitive) chosen by the user, e.g. PRDCLNT100. ' +
            'Omit it to get the saved list for this profile (profile config.json → remoteDestinations).'),
        acknowledge_risk: z
            .boolean()
            .optional()
            .describe("Set to true ONLY after the user has explicitly authorized row extraction from an 'ask'-tier protected table."),
    },
};
/** Path of the active profile's config.json, or null when no profile alias is active (legacy sap.env). */
function profileConfigPath() {
    const alias = (0, profile_1.getActiveAlias)();
    if (!alias)
        return null;
    const home = process.env.SC4SAP_HOME_DIR || path.join(os.homedir(), '.sc4sap');
    return path.join(home, 'profiles', alias, 'config.json');
}
/** Destinations saved for the active profile, most recently used first (empty when none / unreadable). */
function readRemoteDestinations() {
    const file = profileConfigPath();
    if (!file || !fs.existsSync(file))
        return [];
    try {
        const list = JSON.parse(fs.readFileSync(file, 'utf8')).remoteDestinations;
        return Array.isArray(list)
            ? list.filter((d) => typeof d === 'string' && d)
            : [];
    }
    catch {
        return [];
    }
}
/**
 * Moves `dest` to the front of the saved list and writes config.json back, keeping every other key.
 * A failed write is only reported: the read itself already succeeded.
 */
function rememberRemoteDestination(dest) {
    const file = profileConfigPath();
    if (!file || !fs.existsSync(file))
        return;
    try {
        const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
        const prev = Array.isArray(cfg.remoteDestinations)
            ? cfg.remoteDestinations
            : [];
        const next = [dest, ...prev.filter((d) => d !== dest)].slice(0, DEST_KEEP);
        if (JSON.stringify(next) === JSON.stringify(prev))
            return;
        cfg.remoteDestinations = next;
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
        fs.renameSync(tmp, file);
    }
    catch (e) {
        process.stderr.write(`[mcp-abap-adt] remote destination not saved: ${String(e)}\n`);
    }
}
/**
 * Splits an Open SQL condition into RFC_READ_TABLE OPTIONS lines of at most `width` characters.
 * Breaks only at whitespace outside quoted literals, so a literal is never cut in two.
 * @returns the lines (empty array for an empty condition)
 */
function splitWhereLines(condition, width = OPTION_WIDTH) {
    const tokens = [];
    let cur = '';
    let quoted = false;
    for (const ch of String(condition ?? '')) {
        if (ch === "'")
            quoted = !quoted; // '' inside a literal toggles twice and stays quoted
        if (!quoted && /\s/.test(ch)) {
            if (cur)
                tokens.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (quoted)
        throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'where: unclosed quote in the condition');
    if (cur)
        tokens.push(cur);
    const lines = [];
    let line = '';
    for (const t of tokens) {
        if (t.length > width) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `where: "${t.slice(0, 40)}…" is longer than ${width} characters; RFC_READ_TABLE cannot split it`);
        }
        if (!line)
            line = t;
        else if (line.length + 1 + t.length <= width)
            line += ` ${t}`;
        else {
            lines.push(line);
            line = t;
        }
    }
    if (line)
        lines.push(line);
    return lines;
}
/**
 * callDispatch throws "ZMCP_ADT_DISPATCH error (action=…, subrc=…): <message>" on a non-zero subrc.
 * Returns the REMOTE_READ message unchanged, or an install hint when the dispatcher lacks the action.
 */
function dispatchErrorText(error) {
    const msg = String(error?.message ?? error);
    if (/Unknown action:\s*REMOTE_READ/i.test(msg)) {
        return ('REMOTE_READ is not in ZMCP_ADT_DISPATCH on the connected system. Upload the current ' +
            'dispatcher source (sc4sap abap/zmcp_adt_dispatch.abap or _ecc.abap) there first.');
    }
    return msg.replace(/^ZMCP_ADT_DISPATCH error \(action=REMOTE_READ, subrc=\d+\):\s*/, '');
}
/**
 * GetRemoteTableContents: rows of one table in another SAP system via the dispatcher action
 * REMOTE_READ (RFC_READ_TABLE over the SM59 ABAP destination the user named).
 * @returns destination, table, fields [{name,type,length,text}], rows, count — or, without a
 *   destination, an error listing the saved destinations so the agent can ask the user.
 */
async function handleGetRemoteTableContents(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.table_name) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'table_name is required');
        }
        const destination = String(args.destination ?? '').trim(); // SM59 names are case-sensitive
        if (!destination) {
            // No default destination on purpose: the agent shows the saved list and lets the user pick.
            const saved = readRemoteDestinations();
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, saved.length
                ? `destination is required. Saved for this profile (most recent first): ${saved.join(', ')}. ` +
                    'Ask the user to pick one of them or to name another SM59 destination.'
                : 'destination is required and none is saved for this profile yet. Ask the user for the SM59 destination name.');
        }
        const tableName = String(args.table_name).trim().toUpperCase();
        const verdict = (0, tableBlocklist_1.evaluateHits)((0, tableBlocklist_1.checkTables)([tableName]), args.acknowledge_risk === true, (0, tableBlocklist_1.activeProfile)());
        if (verdict.kind === 'deny' || verdict.kind === 'ask') {
            logger?.warn(`GetRemoteTableContents ${verdict.kind}: ${tableName}`);
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidRequest, verdict.message);
        }
        if (verdict.kind === 'approved') {
            process.stderr.write(`[mcp-abap-adt][blocklist] AUDIT: user-acknowledged GetRemoteTableContents on ${verdict.tables.join(',')}\n`);
        }
        const requested = Number(args.max_rows) > 0
            ? Math.floor(Number(args.max_rows))
            : DEFAULT_ROWS;
        const params = {
            destination,
            table_name: tableName,
            field_list: Array.isArray(args.fields)
                ? args.fields
                    .map((f) => String(f).trim().toUpperCase())
                    .filter(Boolean)
                : [],
            options: splitWhereLines(args.where),
            max_rows: Math.min(requested, MAX_ROWS),
            skip_rows: Number(args.skip_rows) > 0 ? Math.floor(Number(args.skip_rows)) : 0,
        };
        let result;
        try {
            ({ result } = await (0, rfcBackend_1.callDispatch)(connection, 'REMOTE_READ', params));
        }
        catch (e) {
            throw new Error(dispatchErrorText(e));
        }
        rememberRemoteDestination(destination); // saved only after a read worked, so typos never enter the list
        return {
            isError: false,
            content: [
                {
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result),
                },
            ],
        };
    }
    catch (error) {
        logger?.error('GetRemoteTableContents failed', error);
        return {
            isError: true,
            content: [{ type: 'text', text: `ADT error: ${String(error)}` }],
        };
    }
}
//# sourceMappingURL=handleGetRemoteTableContents.js.map