"use strict";
/**
 * ST22 dumps on legacy systems (ECC / BASIS 7.40).
 *
 * The ADT dump feed there (CL_SABP_RABAX_ADT_RES_DUMPS->get_feed) only looks
 * back 24 hours: it computes `from = max(now - 86400 s, requested from)`, so
 * an older `from` is silently ignored and the feed comes back empty. ST22
 * itself reads table SNAP, which is on the row-extraction blocklist because
 * it holds variable values.
 *
 * This module lists older dumps through the ZMCP_ADT_DISPATCH action
 * DUMP_LIST (abap/zmcp_adt_dispatch_ecc.abap, FORM dump_list): SNAP header
 * rows only — date, time, server, user, client, runtime error, program,
 * include, line — with the same authority checks as ST22. It also builds the
 * ADT dump id so RuntimeGetDumpById / RuntimeAnalyzeDump can open the dump.
 *
 * Single-dump reads: 7.40 has no REST resource for one dump (the vit path is
 * GUI integration only); `getDumpWithFallback` explains that on ECC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_DUMP_DETAIL_HINT = exports.ADT_DUMP_FEED_WINDOW_MS = void 0;
exports.isLegacyDumpSystem = isLegacyDumpSystem;
exports.toSapDate = toSapDate;
exports.isOlderThanFeedWindow = isOlderThanFeedWindow;
exports.buildDumpId = buildDumpId;
exports.mapDumpListResult = mapDumpListResult;
exports.listLegacyDumps = listLegacyDumps;
exports.legacyDumpSupplement = legacyDumpSupplement;
exports.getDumpWithFallback = getDumpWithFallback;
const rfcBackend_1 = require("./rfcBackend");
/** The ADT feed on BASIS 7.40 never returns dumps older than this. */
exports.ADT_DUMP_FEED_WINDOW_MS = 24 * 60 * 60 * 1000;
/** True for ECC profiles — the only place the dispatcher action is installed. */
function isLegacyDumpSystem() {
    return process.env.SAP_VERSION?.toUpperCase() === 'ECC';
}
/** Digits only: "2026-10-19" / "20261019" / "20261019220421" → "20261019…". */
const digits = (v) => String(v ?? '').replace(/\D/g, '');
/** YYYYMMDD from a date-ish input (YYYYMMDD, YYYY-MM-DD, YYYYMMDDHHMMSS). Empty when unusable. */
function toSapDate(v) {
    const d = digits(v);
    return d.length >= 8 ? d.slice(0, 8) : '';
}
/** True when `from` starts before the 24-hour window of the ADT feed. */
function isOlderThanFeedWindow(from, now = Date.now()) {
    const d = toSapDate(from);
    if (!d)
        return false;
    const t = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
    return now - t > exports.ADT_DUMP_FEED_WINDOW_MS;
}
const pad = (v, n) => String(v ?? '')
    .slice(0, n)
    .padEnd(n, ' ');
/**
 * ADT dump id as CL_RABAX_ADT_URI_BUILDER_DUMPS=>serialize_dump_id builds it:
 * the SNAP key moved into fixed-width character fields, then assigned to a
 * string (trailing blanks dropped).
 */
function buildDumpId(k) {
    return (pad(digits(k.datum), 8) +
        pad(digits(k.uzeit), 6) +
        pad(k.ahost, 32) +
        pad(k.uname, 12) +
        pad(k.mandt, 3) +
        pad(k.modno, 10)).replace(/\s+$/, '');
}
/** Case-insensitive field read — /ui2/cl_json serializes names in upper case. */
function field(row, name) {
    if (name in row)
        return row[name];
    const upper = name.toUpperCase();
    if (upper in row)
        return row[upper];
    const hit = Object.keys(row).find((k) => k.toLowerCase() === name);
    return hit ? row[hit] : undefined;
}
/** Map the DUMP_LIST result (any key case, D/T as ISO or SAP format) to LegacyDump rows. */
function mapDumpListResult(result) {
    const obj = (result && typeof result === 'object' ? result : {});
    const rows = field(obj, 'dumps');
    const list = Array.isArray(rows) ? rows : [];
    const dumps = list.map((r) => {
        const row = (r ?? {});
        const key = {
            datum: field(row, 'datum'),
            uzeit: field(row, 'uzeit'),
            ahost: String(field(row, 'ahost') ?? '').trim(),
            uname: String(field(row, 'uname') ?? '').trim(),
            mandt: String(field(row, 'mandt') ?? '').trim(),
            modno: String(field(row, 'modno') ?? '').trim(),
        };
        const date = digits(key.datum).slice(0, 8);
        const time = digits(key.uzeit).slice(0, 6);
        return {
            dump_id: buildDumpId(key),
            date: date
                ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
                : '',
            time: time
                ? `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
                : '',
            host: key.ahost,
            user: key.uname,
            client: key.mandt,
            runtime_error: String(field(row, 'runtime_error') ?? '').trim(),
            program: String(field(row, 'program') ?? '').trim(),
            include: String(field(row, 'include') ?? '').trim(),
            line: String(field(row, 'line') ?? '').trim(),
        };
    });
    const truncated = field(obj, 'truncated');
    return { dumps, truncated: truncated === true || truncated === 'X' };
}
/** List dumps older than the ADT feed window through the dispatcher. */
async function listLegacyDumps(connection, opts) {
    const date_from = toSapDate(opts.from);
    const date_to = toSapDate(opts.to);
    const { result, subrc, message } = await (0, rfcBackend_1.callDispatch)(connection, 'DUMP_LIST', {
        date_from,
        date_to,
        user: opts.user ?? '',
        max_rows: opts.maxRows ?? 200,
    });
    if (subrc !== 0) {
        const hint = /Unknown action/i.test(message)
            ? ' — the installed ZMCP_ADT_DISPATCH has no DUMP_LIST action; reinstall the sc4sap ABAP utilities (setup step 9)'
            : '';
        throw new Error(`DUMP_LIST failed (subrc=${subrc}): ${message}${hint}`);
    }
    const { dumps, truncated } = mapDumpListResult(result);
    return {
        source: 'ZMCP_ADT_DISPATCH DUMP_LIST',
        date_from,
        date_to,
        count: dumps.length,
        truncated,
        dumps,
    };
}
/**
 * When a dump feed request on a legacy system can miss dumps (older `from`,
 * or an empty feed), add the dispatcher list. Never throws: a failure is
 * returned as `{ error }` so the feed result still reaches the caller.
 */
async function legacyDumpSupplement(connection, opts) {
    if (!isLegacyDumpSystem())
        return undefined;
    const older = isOlderThanFeedWindow(opts.from);
    if (!older && opts.feedCount > 0)
        return undefined;
    try {
        return await listLegacyDumps(connection, opts);
    }
    catch (e) {
        return { error: e?.message ?? String(e) };
    }
}
/** Guidance appended when a single-dump read fails on ECC (BASIS 7.40). */
exports.LEGACY_DUMP_DETAIL_HINT = 'ECC / BASIS 7.40 has no ADT resource for one dump (/sap/bc/adt/runtime/dump/<id> and the GUI-only /sap/bc/adt/vit/runtime/dumps/<id> both answer 404). ' +
    'Dumps from the last 24 hours: RuntimeListDumps with include_summary=true carries the full summary per entry. ' +
    'Older dumps: RuntimeListDumps date_from/date_to returns runtime error, program, include and line under st22 — read that source with GetInclude / GetProgram.';
/**
 * Read one dump through the client library. On ECC a 404 is rewritten with
 * LEGACY_DUMP_DETAIL_HINT so the caller knows which tool to use instead.
 */
async function getDumpWithFallback(connection, primary, _dumpId, _view) {
    void connection;
    try {
        return await primary();
    }
    catch (error) {
        const status = error?.response?.status ?? error?.status;
        const notFound = status === 404 ||
            /ResourceNotFound|status code 404/i.test(String(error?.message ?? ''));
        if (!isLegacyDumpSystem() || !notFound)
            throw error;
        const err = new Error(`${error?.message ?? error} — ${exports.LEGACY_DUMP_DETAIL_HINT}`);
        err.response = error?.response;
        throw err;
    }
}
//# sourceMappingURL=legacyDumps.js.map