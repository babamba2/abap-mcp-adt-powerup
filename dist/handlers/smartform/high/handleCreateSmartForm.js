"use strict";
/**
 * CreateSmartForm — create or replace a SmartForm from Form Builder XML
 * (the format of SMARTFORMS > Utilities > Download, FB_CONVERT_FORM_TO_XML,
 * and the `xml` that GetSmartFormContent stores).
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_UPLOAD_XML → FM ZMCP_SSF_UPLOAD,
 * which loads the XML with CL_SSF_FB_SMART_FORM->XML_UPLOAD, checks the form
 * and stores it active (generating its function module) when the check finds
 * no error — otherwise inactive, with the check messages in the result.
 * Companion ABAP source: sc4sap/abap/zmcp_ssf_upload.abap
 */
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
exports.TOOL_DEFINITION = exports.SSF_UPLOAD_INSTALL_HINT = void 0;
exports.uploadParts = uploadParts;
exports.handleCreateSmartForm = handleCreateSmartForm;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const zlib = __importStar(require("node:zlib"));
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.SSF_UPLOAD_INSTALL_HINT = 'The SAP side of CreateSmartForm is not installed on this system: it needs FM ZMCP_SSF_UPLOAD ' +
    '(function group ZMCP_ADT_UTILS) and the SSF_UPLOAD_XML branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_upload.abap).';
/** base64 characters per dispatcher call (URL-encoded it stays below 8 KB). */
const UPLOAD_PART_CHARS = 5000;
exports.TOOL_DEFINITION = {
    name: 'CreateSmartForm',
    available_in: ['onprem', 'legacy'],
    description: '[writes] Create (or, with overwrite, replace) a Z/Y SmartForm from Form Builder XML — the format of SMARTFORMS > Utilities > Download. The form is checked and stored active (function module generated) when the check finds no error; otherwise it is stored inactive and the check errors are returned. SmartStyles and SE78 graphics the XML names must already exist. Needs the ZMCP_SSF_UPLOAD FM and the SSF_UPLOAD_XML dispatcher action.',
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'Target SmartForm name, Z* or Y* (e.g. "ZMY_FORM").',
            },
            xml_file: {
                type: 'string',
                description: 'Path of the Form Builder XML file (UTF-8).',
            },
            package_name: {
                type: 'string',
                description: 'Package. Default $TMP; any other package needs transport_request.',
            },
            transport_request: {
                type: 'string',
                description: 'Transport request the form is recorded in.',
            },
            overwrite: {
                type: 'boolean',
                description: 'Replace the form when it exists. Default false (an existing form is refused).',
            },
            activate: {
                type: 'boolean',
                description: 'Check and store active. Default true; false stores the form inactive without a check.',
            },
        },
        required: ['form_name', 'xml_file'],
    },
};
/**
 * The XML as the dispatcher takes it: the OData backend carries the params in
 * the URL (~8 KB), so the XML goes raw-deflate compressed (what CL_ABAP_GZIP
 * reads) and base64-encoded, in parts the dispatcher joins on the last one.
 */
function uploadParts(xml, partChars = UPLOAD_PART_CHARS) {
    const b64 = zlib.deflateRawSync(xml).toString('base64');
    const parts = [];
    for (let i = 0; i < b64.length; i += partChars)
        parts.push(b64.slice(i, i + partChars));
    return parts.length ? parts : [''];
}
async function handleCreateSmartForm(context, args) {
    const { connection, logger } = context;
    try {
        const formName = String(args?.form_name ?? '')
            .trim()
            .toUpperCase();
        if (!/^[ZY]/.test(formName))
            return (0, utils_1.return_error)(new Error('form_name must start with Z or Y'));
        if (!args?.xml_file)
            return (0, utils_1.return_error)(new Error('xml_file is required'));
        const xml = fs.readFileSync(args.xml_file);
        const devclass = (args.package_name ?? '').trim().toUpperCase() || '$TMP';
        if (!devclass.startsWith('$') && !args.transport_request)
            return (0, utils_1.return_error)(new Error(`package ${devclass} needs transport_request`));
        logger?.info(`CreateSmartForm: ${formName} (${devclass})`);
        const parts = uploadParts(xml);
        const uploadId = crypto.randomBytes(6).toString('hex').toUpperCase();
        let resp;
        try {
            for (let p = 0; p < parts.length; p++)
                resp = await (0, rfcBackend_1.callDispatch)(connection, 'SSF_UPLOAD_XML', {
                    form_name: formName,
                    xml: parts[p],
                    gzip: 'X',
                    upload_id: uploadId,
                    part: p + 1,
                    parts: parts.length,
                    devclass,
                    transport: (args.transport_request ?? '').trim().toUpperCase(),
                    overwrite: args.overwrite ? 'X' : '',
                    activate: args.activate === false ? '-' : 'X',
                });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (/Unknown action:\s*SSF_UPLOAD_XML/i.test(msg) ||
                /ZMCP_SSF_UPLOAD[\s\S]*not found/i.test(msg))
                throw new Error(`${exports.SSF_UPLOAD_INSTALL_HINT} (SAP said: ${msg})`);
            throw error;
        }
        // callDispatch throws on subrc <> 0; a form stored inactive because the
        // check failed comes back with subrc 0, active = false and the errors
        const { result, message } = resp ?? {};
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                ...(typeof result === 'object' ? result : {}),
                message: message || undefined,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`CreateSmartForm error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleCreateSmartForm.js.map