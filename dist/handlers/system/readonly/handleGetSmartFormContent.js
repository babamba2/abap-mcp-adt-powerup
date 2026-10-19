"use strict";
/**
 * GetSmartFormContent — read-only: what each window of a SmartForm prints.
 *
 * Source: the Form Builder XML of the active version (FB_CONVERT_FORM_TO_XML,
 * the same XML as SMARTFORMS > Utilities > Download), parsed into pages →
 * windows → content nodes. Styles (CSS), SE78 graphics (BMP) and include
 * texts with a fixed key are fetched too and written as files under the MCP
 * output directory. Program lines (code nodes, global coding) are never
 * returned — a code node only shows up as a marker.
 *
 * Backend: ZMCP_ADT_DISPATCH action SSF_CONTENT through callDispatch, so it
 * runs on the OData backend (BASIS 7.40) and on SOAP RFC (BASIS 7.31) alike.
 *
 * Companion ABAP sources: sc4sap/abap/zmcp_ssf_content.abap and
 * sc4sap/abap/zmcp_adt_dispatch_ssf_content_branch.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetSmartFormContent = handleGetSmartFormContent;
const smartFormContent_1 = require("../../../lib/smartFormContent");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'GetSmartFormContent',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Read what a SmartForm prints, for a preview: per page and window (position in mm) the content tree — text nodes with their lines (paragraph format + text with inline tags and &symbols&), include texts, tables / templates / loops with line types and cells, graphics, addresses, conditions; code nodes appear only as markers (no program lines). Also fetches the SmartStyles as CSS, the SE78 graphics with a fixed key as BMP files (with printed size) and the include texts with a fixed key. Graphics / texts whose key holds a &symbol& are listed under dynamicReferences. Active version, texts in the logon language. Files go under the MCP output directory (smartforms/<form>/), including <form>.content.json with the full result; summary=true answers with an overview (windows, data declarations, &symbols&, files) instead of the content tree. Needs the ZMCP_SSF_CONTENT FM and the SSF_CONTENT dispatcher action.',
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'SmartForm name (e.g. "ZMY_FORM").',
            },
            include_graphics: {
                type: 'boolean',
                description: 'Fetch SE78 graphics with a fixed key as BMP files. Default true.',
            },
            include_styles: {
                type: 'boolean',
                description: 'Fetch the SmartStyles (form default + text node styles) as CSS. Default true.',
            },
            include_texts: {
                type: 'boolean',
                description: 'Fetch include texts (SO10) with a fixed key. Default true.',
            },
            summary: {
                type: 'boolean',
                description: 'Answer with an overview (windows, data declarations, &symbols&, graphics, files) instead of the full content tree; the full result is always written to files.content. Default false.',
            },
            values: {
                type: 'object',
                description: 'Sample values for &symbols& in graphic keys (e.g. {"IM_SIGN": "ZSIGN"}): graphics named by a variable are then fetched too.',
            },
            device: {
                type: 'string',
                description: 'Output device whose printer fonts the preview should assume. Default: a device whose type has fonts for most of the families of the form.',
            },
            text_language: {
                type: 'string',
                description: 'Language for include texts whose key has no language: 1-char SAP key (e.g. "3") or 2-letter ISO code (e.g. "KO"). Default: the form language.',
            },
        },
        required: ['form_name'],
    },
};
async function handleGetSmartFormContent(context, args) {
    const { connection, logger } = context;
    try {
        const formName = String(args?.form_name ?? '')
            .trim()
            .toUpperCase();
        if (!formName) {
            return (0, utils_1.return_error)(new Error('form_name is required'));
        }
        logger?.info(`GetSmartFormContent: ${formName}`);
        const content = await (0, smartFormContent_1.getSmartFormContent)(connection, formName, {
            includeGraphics: args?.include_graphics,
            includeStyles: args?.include_styles,
            includeTexts: args?.include_texts,
            textLanguage: args?.text_language
                ? String(args.text_language).trim()
                : undefined,
            device: args?.device ? String(args.device).trim() : undefined,
            values: args?.values && typeof args.values === 'object'
                ? args.values
                : undefined,
        });
        return (0, utils_1.return_response)({
            data: JSON.stringify(args?.summary ? (0, smartFormContent_1.summarizeSmartFormContent)(content) : content, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`GetSmartFormContent error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleGetSmartFormContent.js.map