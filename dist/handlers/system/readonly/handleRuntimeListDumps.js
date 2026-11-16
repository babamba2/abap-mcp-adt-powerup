"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.stripDumpSummaries = stripDumpSummaries;
exports.nextFeedCursor = nextFeedCursor;
exports.pageFeedBack = pageFeedBack;
exports.handleRuntimeListDumps = handleRuntimeListDumps;
const mcp_abap_adt_clients_1 = require("@babamba2/mcp-abap-adt-clients");
const legacyDumps_1 = require("../../../lib/legacyDumps");
const utils_1 = require("../../../lib/utils");
const runtimePayloadParser_1 = require("./runtimePayloadParser");
exports.TOOL_DEFINITION = {
    name: 'RuntimeListDumps',
    available_in: ['onprem', 'cloud'],
    description: "[runtime] List ABAP runtime dumps with optional user filter and paging. Returns parsed JSON payload. On ECC the ADT feed only covers the last 24 hours: pass date_from / date_to for older dumps — they come back under `st22` (SNAP headers via ZMCP_ADT_DISPATCH DUMP_LIST) with a dump_id for RuntimeGetDumpById. Each entry's HTML summary (~13 KB per dump) is omitted unless include_summary=true — use RuntimeGetDumpById / RuntimeAnalyzeDump for one dump's details.",
    inputSchema: {
        type: 'object',
        properties: {
            user: {
                type: 'string',
                description: 'Optional username filter. If omitted, dumps for all users are returned.',
            },
            inlinecount: {
                type: 'string',
                enum: ['allpages', 'none'],
                description: 'Include total count metadata.',
            },
            top: {
                type: 'number',
                description: 'Maximum number of records to return.',
            },
            skip: {
                type: 'number',
                description: 'Number of records to skip.',
            },
            orderby: {
                type: 'string',
                description: 'ADT order by expression.',
            },
            date_from: {
                type: 'string',
                description: 'Start date (YYYYMMDD or YYYY-MM-DD). The ADT feed is followed back page by page (its `next` cursor) until it reaches this day — `paging.reached` says whether an entry older than this day was seen, `paging.oldest` the oldest day read (max 20 pages). On ECC a date older than 24 hours (or an empty feed) also adds the ST22 list for date_from..date_to under `st22`.',
            },
            date_to: {
                type: 'string',
                description: 'End date (YYYYMMDD or YYYY-MM-DD). Default: today.',
            },
            include_summary: {
                type: 'boolean',
                description: "Keep each entry's HTML summary (atom:summary). Default false — it is ~96% of the payload and duplicates what RuntimeGetDumpById returns.",
            },
        },
        required: [],
    },
};
/**
 * Drop `atom:summary` from every feed entry, leaving the feed's shape intact.
 *
 * The summary is a full HTML rendering of the dump (tables, source excerpt,
 * call stack) — about 12.7 KB of a 13.3 KB entry. A 20-dump list came back at
 * 250 KB, most of which an agent never reads from a list: it picks an entry by
 * error name / program / user / time and then asks for that one dump. Ids,
 * categories, titles, timestamps and links all stay.
 */
function stripDumpSummaries(payload) {
    if (!payload || typeof payload !== 'object')
        return payload;
    const feed = payload['atom:feed'];
    if (!feed || typeof feed !== 'object')
        return payload;
    const entries = feed['atom:entry'];
    const strip = (entry) => {
        if (!entry || typeof entry !== 'object')
            return entry;
        const { 'atom:summary': _omitted, ...rest } = entry;
        return rest;
    };
    return {
        ...payload,
        'atom:feed': {
            ...feed,
            'atom:entry': Array.isArray(entries)
                ? entries.map(strip)
                : strip(entries),
        },
    };
}
const entriesOf = (parsed) => {
    const e = parsed?.['atom:feed']?.['atom:entry'];
    return Array.isArray(e) ? e : e ? [e] : [];
};
/**
 * The `to` cursor of the feed's `next` link (`…/dumps?$top=100&to=20261114154628`).
 * The ADT dump feed pages by time, not by `$skip` (measured on S/4HANA 2026-11-16:
 * `$skip` and `$orderby` are ignored and every call returns the newest page).
 */
function nextFeedCursor(parsed) {
    const links = parsed?.['atom:feed']?.['atom:link'];
    const list = Array.isArray(links) ? links : links ? [links] : [];
    const next = list.find((l) => l?.rel === 'next')?.href;
    if (typeof next !== 'string')
        return null;
    const m = /[?&]to=(\d{14})/.exec(next);
    return m ? m[1] : null;
}
/** YYYYMMDD of a date_from given as YYYYMMDD or YYYY-MM-DD, or null. */
const dayOf = (d) => {
    const s = String(d || '').replace(/-/g, '');
    return /^\d{8}$/.test(s) ? s : null;
};
/**
 * Walk the feed back from the first page until an entry is older than `dateFrom`
 * (YYYYMMDD), the feed ends, or `maxPages` pages were read. Entries are merged into
 * the first page's feed (deduplicated by id); `complete` says whether `dateFrom`
 * was reached.
 */
async function pageFeedBack(first, dateFrom, fetchPage, maxPages = 20) {
    const all = entriesOf(first);
    const seen = new Set(all.map((e) => e?.['atom:id']));
    const older = (es) => es.some((e) => String(e?.['atom:published'] || '').replace(/-/g, '').slice(0, 8) <
        dateFrom);
    let cursor = nextFeedCursor(first);
    let pages = 1;
    let complete = !cursor || older(all);
    while (!complete && cursor && pages < maxPages) {
        const page = await fetchPage(cursor);
        pages += 1;
        const es = entriesOf(page);
        const fresh = es.filter((e) => !seen.has(e?.['atom:id']));
        for (const e of fresh)
            seen.add(e?.['atom:id']);
        all.push(...fresh);
        const nextCursor = nextFeedCursor(page);
        complete = fresh.length === 0 || older(es) || !nextCursor;
        cursor = nextCursor === cursor ? null : nextCursor;
        if (!cursor)
            complete = true;
    }
    const feed = first?.['atom:feed'] || {};
    // `reached`: an entry older than dateFrom was seen. A feed that simply ends
    // before that (retention deleted older dumps) is complete, but not reached.
    const days = all
        .map((e) => String(e?.['atom:published'] || '').replace(/-/g, '').slice(0, 8))
        .filter((d) => /^\d{8}$/.test(d))
        .sort();
    return {
        parsed: { ...first, 'atom:feed': { ...feed, 'atom:entry': all } },
        pages,
        complete,
        reached: older(all),
        oldest: days[0] || '',
    };
}
async function handleRuntimeListDumps(context, args) {
    const { connection, logger } = context;
    try {
        const runtimeClient = new mcp_abap_adt_clients_1.AdtRuntimeClient(connection, logger);
        const { user, inlinecount, top, skip, orderby, include_summary } = args || {};
        const response = user
            ? await runtimeClient.listRuntimeDumpsByUser(user, {
                inlinecount,
                top,
                skip,
                orderby,
            })
            : await runtimeClient.listRuntimeDumps({
                inlinecount,
                top,
                skip,
                orderby,
            });
        let parsed = (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(response.data);
        // date_from on a feed that pages by time: follow its `next` cursor back to that day.
        let paging;
        const from = dayOf(args?.date_from);
        if (from && skip === undefined) {
            const walked = await pageFeedBack(parsed, from, async (cursor) => {
                const params = new URLSearchParams();
                if (user)
                    params.set('$query', `and( equals( user, ${user.trim()} ) )`);
                if (top)
                    params.set('$top', String(top));
                params.set('to', cursor);
                const page = await connection.makeAdtRequest({
                    url: `/sap/bc/adt/runtime/dumps?${params.toString()}`,
                    method: 'GET',
                    timeout: 30000,
                    headers: { Accept: 'application/atom+xml;type=feed' },
                });
                return (0, runtimePayloadParser_1.parseRuntimePayloadToJson)(page.data);
            });
            parsed = walked.parsed;
            paging = {
                pages: walked.pages,
                complete: walked.complete,
                reached: walked.reached,
                oldest: walked.oldest,
            };
        }
        const feedEntries = parsed?.['atom:feed']?.['atom:entry'];
        const feedCount = Array.isArray(feedEntries)
            ? feedEntries.length
            : feedEntries
                ? 1
                : 0;
        const st22 = await (0, legacyDumps_1.legacyDumpSupplement)(connection, {
            from: args?.date_from,
            to: args?.date_to,
            user,
            maxRows: top,
            feedCount,
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                user_filter: user || null,
                status: response.status,
                payload: include_summary ? parsed : stripDumpSummaries(parsed),
                ...(paging ? { paging } : {}),
                ...(st22 ? { st22 } : {}),
            }, null, 2),
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config,
        });
    }
    catch (error) {
        logger?.error('Error listing runtime dumps:', error);
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleRuntimeListDumps.js.map