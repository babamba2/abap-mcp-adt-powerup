"use strict";
/**
 * ReadTextElementsBulk — return every text element of a program in ONE call.
 *
 * Matches WriteTextElementsBulk semantics: we read the whole TPOOL via the
 * `ZMCP_ADT_TEXTPOOL` RFC (single SAP round-trip) and partition the rows
 * by ID (R / I / S / H). The native /textelements subsource endpoints
 * exist but only surface the editor-view of I/S/H and don't expose R at
 * all, so using TPOOL RFC directly keeps this tool aligned with the
 * WriteTextElementsBulk storage path and exposes every type uniformly.
 *
 * Existing single-row GetTextElement stays row-by-row for callers that
 * want one entry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadTextElementsBulk = handleReadTextElementsBulk;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadTextElementsBulk',
    available_in: ['onprem', 'legacy'],
    description: 'Read every text element (R/I/S/H) of a program in ONE call via the TPOOL RFC. Partitions rows by type and returns structured arrays. Use this instead of calling GetTextElement per row.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: { type: 'string', description: 'Program name.' },
            language: {
                type: 'string',
                description: '1-char language. Defaults to SAP logon language.',
            },
        },
        required: ['program_name'],
    },
};
async function handleReadTextElementsBulk(context, params) {
    const { connection, logger } = context;
    const args = params;
    if (!args?.program_name) {
        return (0, utils_1.return_error)(new Error('program_name is required'));
    }
    if ((0, utils_1.isCloudConnection)()) {
        return (0, utils_1.return_error)(new Error('Text elements are not available on ABAP Cloud'));
    }
    const programName = args.program_name.toUpperCase();
    const language = (args.language || '').toUpperCase();
    logger?.info(`ReadTextElementsBulk: ${programName}`);
    try {
        const { result: fetched } = await (0, rfcBackend_1.callTextpool)(connection, 'READ', {
            program: programName,
            language,
        });
        const raw = Array.isArray(fetched) ? fetched : [];
        const bucket = {
            R: [],
            I: [],
            S: [],
            H: [],
        };
        let rEntry = null;
        for (const r of raw) {
            const id = String(r?.ID ?? r?.id ?? '').toUpperCase();
            const key = String(r?.KEY ?? r?.key ?? '');
            const text = String(r?.ENTRY ?? r?.entry ?? '');
            const length = Number(r?.LENGTH ?? r?.length ?? 0);
            if (id !== 'R' && id !== 'I' && id !== 'S' && id !== 'H')
                continue;
            bucket[id].push({ type: id, key, text, length });
            if (id === 'R')
                rEntry = { text, length };
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                language: language || null,
                counts: {
                    R: bucket.R.length,
                    I: bucket.I.length,
                    S: bucket.S.length,
                    H: bucket.H.length,
                    total: raw.length,
                },
                r: rEntry,
                symbols: bucket.I.map((e) => ({ key: e.key, text: e.text })),
                selections: bucket.S.map((e) => ({
                    key: e.key.trim(),
                    text: e.text,
                })),
                headings: bucket.H.map((e) => ({ key: e.key, text: e.text })),
            }, null, 2),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`ReadTextElementsBulk failed: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(`ReadTextElementsBulk failed: ${errorMessage}`));
    }
}
//# sourceMappingURL=handleReadTextElementsBulk.js.map