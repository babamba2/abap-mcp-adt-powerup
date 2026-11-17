"use strict";
/**
 * GetStandardText — read one SAPscript standard text (SO10, text object TEXT) with READ_TEXT.
 *
 * Backend: ZMCP_ADT_DISPATCH action SSF_CONTENT, part STDTEXT (the part GetSmartFormContent already uses for
 * include texts) — no new SAP code. Text object TEXT only. Development profiles only (server tier guard):
 * standard texts can carry business wording.
 *
 * Companion ABAP sources: sc4sap/abap/zmcp_ssf_content.abap and
 * sc4sap/abap/zmcp_adt_dispatch_ssf_content_branch.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetStandardText = handleGetStandardText;
const smartFormContent_1 = require("../../../lib/smartFormContent");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetStandardText',
    available_in: ['onprem', 'legacy'],
    description: '[read-only, DEV profiles only] Read one SAPscript standard text (SO10, text object TEXT) — the lines with their paragraph formats, as READ_TEXT returns them. For include texts that forms print (e.g. an Adobe or SmartForm include text with a fixed name). Business document texts (other text objects) are not reachable. Needs the ZMCP_SSF_CONTENT FM and the SSF_CONTENT dispatcher action.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Standard text name as in SO10 (e.g. "SAPSCRIPT-DRUCKERTEST").',
            },
            text_id: {
                type: 'string',
                description: 'Text ID (default ST).',
            },
            language: {
                type: 'string',
                description: '1-character SAP language key (E, D, …); empty = logon language.',
            },
        },
        required: ['name'],
    },
};
async function handleGetStandardText(context, args) {
    const { connection, logger } = context;
    try {
        logger?.info(`GetStandardText: ${args?.name}`);
        const result = await (0, smartFormContent_1.getStandardText)(connection, args?.name, args?.text_id || 'ST', args?.language ?? '');
        return (0, utils_1.return_response)({
            data: JSON.stringify(result, null, 2),
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger?.error(`GetStandardText error: ${msg}`);
        return (0, utils_1.return_error)(new Error(msg));
    }
}
//# sourceMappingURL=handleGetStandardText.js.map