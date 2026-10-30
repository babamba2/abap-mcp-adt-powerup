"use strict";
/**
 * WriteTextElementsBulk — register many text elements in a SINGLE call.
 *
 * Previously a 40-element load meant 40 separate tool invocations of
 * CreateTextElement, each doing its own LOCK / RFC READ / RFC WRITE /
 * UNLOCK cycle → 160+ round-trips and a read-then-write race when
 * parallelized. This handler folds every entry (R / I / S / H) into a
 * single `ZMCP_ADT_TEXTPOOL` RFC call.
 *
 * SAP's native pattern for TPOOL is a whole-pool INSERT (what SE38 → GoTo
 * → Text Elements does internally). We follow the same pattern:
 *
 *   activate=true  → RFC action 'WRITE'           (INSERT TEXTPOOL STATE 'A')
 *   (default)        Pool is written active immediately.
 *   activate=false → RFC action 'WRITE_INACTIVE'  (INSERT TEXTPOOL STATE 'I')
 *                    Pool is staged inactive only. ZMCP_ADT_TEXTPOOL does not
 *                    add it to the inactive worklist, so ADT activation of the
 *                    parent program does NOT promote it (verified on ECC 7.40,
 *                    2026-10-30). Hence the default is true.
 *
 * replace_existing=false re-reads the current pool first and merges the
 * caller's entries by (ID, KEY) so nothing outside the caller's set is
 * wiped.
 *
 * Existing CreateTextElement / UpdateTextElement tools remain untouched.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.restoreSelectionPrefix = restoreSelectionPrefix;
exports.handleWriteTextElementsBulk = handleWriteTextElementsBulk;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
const MAX_ENTRY_LEN = 132;
// TPOOL selection-text rows reserve ENTRY(8) before the visible text.
const SEL_TEXT_PREFIX = ' '.repeat(8);
exports.TOOL_DEFINITION = {
    name: 'WriteTextElementsBulk',
    available_in: ['onprem', 'legacy'],
    description: 'Register many ABAP text elements (R/I/S/H) in ONE tool call via a single TPOOL RFC write. Use instead of calling CreateTextElement N times. With activate=true (default) the pool is written ACTIVE immediately. activate=false only stages the pool INACTIVE and does not register it in the inactive worklist, so a later program activation does NOT promote it — avoid it unless you activate the text pool yourself. Set replace_existing=false to merge into the current pool instead of replacing it.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Parent program name.',
            },
            language: {
                type: 'string',
                description: '1-char language key (e.g. "K" for Korean). Defaults to SAP logon language.',
            },
            text_elements: {
                type: 'array',
                minItems: 1,
                description: 'Array of entries. Each: { type: "R"|"I"|"S"|"H", key?: string, text: string }. R ignores key (single-row program title — key defaults to program name). I requires a 3-char key. S requires a parameter / select-option name (max 8 chars). H requires one of "listHeader" or "columnHeader_N".',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['R', 'I', 'S', 'H'] },
                        key: { type: 'string' },
                        text: { type: 'string' },
                    },
                    required: ['type', 'text'],
                },
            },
            replace_existing: {
                type: 'boolean',
                description: 'If true (default), the TPOOL is replaced with the provided entries only. If false, existing rows are preserved and provided rows merge by (type, key).',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request number (informational).',
            },
            activate: {
                type: 'boolean',
                description: 'true (default) — write ACTIVE immediately. false — stage as INACTIVE only; the pool is NOT added to the inactive worklist, so ActivateObjects on the program does not promote it.',
            },
        },
        required: ['program_name', 'text_elements'],
    },
};
function rowKey(row) {
    return `${row.ID.toUpperCase()}::${row.KEY.trim().toUpperCase()}`;
}
function normalizeEntry(e, programName) {
    const id = e.type.toUpperCase();
    let key;
    if (id === 'R') {
        // Single program-title row — ABAP stores KEY = programName (uppercased).
        key = (e.key?.trim() || programName).toUpperCase();
    }
    else {
        key = (e.key ?? '').trim();
    }
    // Selection texts: ENTRY(8) is reserved (pos 1 = DDIC-reference flag);
    // SE38 shows the text from position 9, so prefix 8 blanks.
    const entry = id === 'S' ? SEL_TEXT_PREFIX + (e.text ?? '') : (e.text ?? '');
    return {
        ID: id,
        KEY: key,
        ENTRY: entry,
        LENGTH: entry.length,
    };
}
/**
 * Puts the reserved ENTRY(8) back on an existing selection-text row. Some RFC
 * reads (S/4HANA) drop the leading blanks of a non-DDIC row; writing it back
 * as read would shift the label by 8 characters in SE38.
 * @param row TPOOL row as read for the merge
 * @returns the row, with the 8-blank prefix restored on an S row that lost it
 */
function restoreSelectionPrefix(row) {
    if (row.ID !== 'S' || /^[D ] {7}/.test(row.ENTRY))
        return row;
    const entry = SEL_TEXT_PREFIX + row.ENTRY;
    return { ...row, ENTRY: entry, LENGTH: entry.length };
}
async function handleWriteTextElementsBulk(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args?.program_name) {
        return (0, utils_1.return_error)(new Error('program_name is required'));
    }
    if (!Array.isArray(args?.text_elements) || args.text_elements.length === 0) {
        return (0, utils_1.return_error)(new Error('text_elements must be a non-empty array'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Text elements are not available on ABAP Cloud'));
    }
    // Input validation — fail before any SAP round-trip.
    const perTypeCount = {};
    const rRows = [];
    for (const [i, e] of args.text_elements.entries()) {
        if (!e?.type || !['R', 'I', 'S', 'H'].includes(e.type)) {
            return (0, utils_1.return_error)(new Error(`text_elements[${i}] has missing or unsupported type "${e?.type}"`));
        }
        if (typeof e.text !== 'string') {
            return (0, utils_1.return_error)(new Error(`text_elements[${i}] "text" must be a string`));
        }
        // a selection text shares ENTRY with its 8-character reserved prefix
        const maxLen = e.type === 'S' ? MAX_ENTRY_LEN - SEL_TEXT_PREFIX.length : MAX_ENTRY_LEN;
        if (e.text.length > maxLen) {
            return (0, utils_1.return_error)(new Error(`text_elements[${i}] text exceeds ${maxLen} chars (${e.text.length})`));
        }
        if (e.type === 'I' || e.type === 'S' || e.type === 'H') {
            if (!e.key) {
                return (0, utils_1.return_error)(new Error(`text_elements[${i}] type "${e.type}" requires "key"`));
            }
            if (e.type === 'S' && e.key.length > 8) {
                return (0, utils_1.return_error)(new Error(`text_elements[${i}] selection key "${e.key}" exceeds 8 chars`));
            }
        }
        perTypeCount[e.type] = (perTypeCount[e.type] ?? 0) + 1;
        if (e.type === 'R')
            rRows.push(e);
    }
    if (rRows.length > 1) {
        return (0, utils_1.return_error)(new Error('Only one R-type entry is allowed per program'));
    }
    const programName = args.program_name.toUpperCase();
    const language = (args.language || '').toUpperCase();
    const replaceExisting = args.replace_existing !== false;
    // Default true: WRITE_INACTIVE does not register the pool in the inactive
    // worklist, so a later program activation never promotes it.
    const shouldActivate = args.activate !== false;
    const action = shouldActivate
        ? 'WRITE'
        : 'WRITE_INACTIVE';
    const steps = [];
    logger?.info(`WriteTextElementsBulk: ${programName} — ${args.text_elements.length} entries (${JSON.stringify(perTypeCount)}); replace_existing=${replaceExisting}; action=${action}`);
    try {
        // Normalize caller input into TPOOL rows.
        const caller = args.text_elements.map((e) => normalizeEntry(e, programName));
        let finalRows;
        if (replaceExisting) {
            finalRows = caller;
        }
        else {
            // Read current pool, merge caller on top by (ID, KEY).
            const { result: fetched } = await (0, rfcBackend_1.callTextpool)(connection, 'READ', {
                program: programName,
                language,
            });
            const existing = (Array.isArray(fetched) ? fetched : []).map((r) => restoreSelectionPrefix({
                ID: String(r?.ID ?? r?.id ?? '').toUpperCase(),
                KEY: String(r?.KEY ?? r?.key ?? ''),
                ENTRY: String(r?.ENTRY ?? r?.entry ?? ''),
                LENGTH: Number(r?.LENGTH ?? r?.length ?? 0),
            }));
            const map = new Map();
            for (const row of existing)
                map.set(rowKey(row), row);
            for (const row of caller)
                map.set(rowKey(row), row);
            finalRows = [...map.values()];
            steps.push('read_existing_for_merge');
        }
        // Single RFC write — regardless of entry count.
        await (0, rfcBackend_1.callTextpool)(connection, action, {
            program: programName,
            language,
            textpool_json: JSON.stringify(finalRows),
        });
        steps.push(action === 'WRITE' ? 'write_active' : 'write_inactive');
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                total_entries: args.text_elements.length,
                per_type: perTypeCount,
                total_rows_written: finalRows.length,
                replace_existing: replaceExisting,
                language_used: language || null,
                activate: shouldActivate,
                rfc_action: action,
                steps_completed: steps,
                message: shouldActivate
                    ? `Wrote ${finalRows.length} active text element row(s) for ${programName}.`
                    : `Staged ${finalRows.length} INACTIVE text element row(s) for ${programName}. Program activation does NOT promote them; re-run with activate=true to make them active.`,
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`WriteTextElementsBulk failed: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`WriteTextElementsBulk failed: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleWriteTextElementsBulk.js.map