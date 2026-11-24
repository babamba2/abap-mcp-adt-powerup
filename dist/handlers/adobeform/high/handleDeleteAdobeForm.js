"use strict";
/**
 * DeleteAdobeForm — delete a local Z/Y Adobe form (SFPF, with its layout and
 * generated function module) or form interface (SFPI). Dry run unless
 * `confirm` is true.
 *
 * SAP side: ZMCP_ADT_DISPATCH action FP_DELETE → FM ZMCP_FP_DELETE.
 * Only objects in package $TMP are deleted (SAP removes the TADIR entry only
 * for $TMP; other packages are refused — use SFP). An interface a form still
 * uses is refused with the list of forms; a form delete keeps its interface.
 * Development clients only.
 * Companion ABAP source: sc4sap/abap/zmcp_fp_delete.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = exports.FP_DELETE_INSTALL_HINT = void 0;
exports.handleDeleteAdobeForm = handleDeleteAdobeForm;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.FP_DELETE_INSTALL_HINT = 'The SAP side of DeleteAdobeForm is not installed on this system: it needs FM ZMCP_FP_DELETE ' +
    '(function group ZMCP_FP) and the FP_DELETE branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_fp_delete.abap).';
exports.TOOL_DEFINITION = {
    name: 'DeleteAdobeForm',
    available_in: ['onprem', 'legacy'],
    description: '[writes, destructive] Delete a Z/Y Adobe form (with its layout and generated function module) or form interface of package $TMP. Without confirm: true only reports what would be deleted (dry run). Objects of any other package are refused; an interface still used by a form is refused with the forms listed; a form delete keeps its interface (delete it afterwards with kind INTERFACE). Development clients only. Needs the ZMCP_FP_DELETE FM and the FP_DELETE dispatcher action.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Form or interface name, Z* or Y* (letters, digits, _ and /, at most 30 characters).',
            },
            kind: {
                type: 'string',
                enum: ['FORM', 'INTERFACE'],
                description: 'FORM (SFPF) or INTERFACE (SFPI).',
            },
            confirm: {
                type: 'boolean',
                description: 'true = really delete. Default false (dry run).',
            },
        },
        required: ['name', 'kind'],
    },
};
const NAME_RE = /^[ZY][A-Z0-9_/]{0,29}$/;
async function handleDeleteAdobeForm(context, args) {
    const { connection, logger } = context;
    try {
        const name = String(args?.name ?? '')
            .trim()
            .toUpperCase();
        if (!NAME_RE.test(name))
            return (0, utils_1.return_error)(new Error('name must start with Z or Y and use only letters, digits, _ and / (at most 30 characters)'));
        const kind = String(args?.kind ?? '')
            .trim()
            .toUpperCase();
        if (kind !== 'FORM' && kind !== 'INTERFACE')
            return (0, utils_1.return_error)(new Error('kind must be FORM or INTERFACE'));
        const confirm = args?.confirm === true;
        logger?.info(`DeleteAdobeForm: ${kind} ${name} (confirm=${confirm})`);
        let resp;
        try {
            resp = await (0, rfcBackend_1.callDispatch)(connection, 'FP_DELETE', {
                name,
                kind,
                confirm: confirm ? 'X' : '',
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (/Unknown action:\s*FP_DELETE/i.test(msg) ||
                /ZMCP_FP_DELETE[\s\S]*not found/i.test(msg))
                throw new Error(`${exports.FP_DELETE_INSTALL_HINT} (SAP said: ${msg})`);
            throw error;
        }
        const { result, message } = resp ?? {};
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                ...(typeof result === 'object' && result !== null ? result : {}),
                message: message || undefined,
            }, null, 2),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger?.error(`DeleteAdobeForm error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleDeleteAdobeForm.js.map