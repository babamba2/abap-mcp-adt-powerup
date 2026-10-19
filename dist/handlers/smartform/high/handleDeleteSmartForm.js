"use strict";
/**
 * DeleteSmartForm — delete a local Z/Y SmartForm (form, generated function
 * module, TADIR entry). Dry run unless `confirm` is true.
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_DELETE_FORM → FM ZMCP_SSF_DELETE.
 * Only forms in a local package ($…) are deleted; a transportable form is
 * refused (its deletion belongs on a transport — use SMARTFORMS).
 * Companion ABAP source: sc4sap/abap/zmcp_ssf_delete.abap
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = exports.SSF_DELETE_INSTALL_HINT = void 0;
exports.handleDeleteSmartForm = handleDeleteSmartForm;
const rfcBackend_1 = require("../../../lib/rfcBackend");
const utils_1 = require("../../../lib/utils");
exports.SSF_DELETE_INSTALL_HINT = 'The SAP side of DeleteSmartForm is not installed on this system: it needs FM ZMCP_SSF_DELETE ' +
    '(function group ZMCP_ADT_UTILS) and the SSF_DELETE_FORM branch in ZMCP_ADT_DISPATCH. ' +
    'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_delete.abap).';
exports.TOOL_DEFINITION = {
    name: 'DeleteSmartForm',
    available_in: ['onprem', 'legacy'],
    description: '[writes, destructive] Delete a Z/Y SmartForm of a local package ($TMP, $…) with its generated function module. Without confirm: true only reports what would be deleted (dry run). Transportable forms are refused. Needs the ZMCP_SSF_DELETE FM and the SSF_DELETE_FORM dispatcher action.',
    inputSchema: {
        type: 'object',
        properties: {
            form_name: {
                type: 'string',
                description: 'SmartForm name, Z* or Y*.',
            },
            confirm: {
                type: 'boolean',
                description: 'true = really delete. Default false (dry run).',
            },
        },
        required: ['form_name'],
    },
};
async function handleDeleteSmartForm(context, args) {
    const { connection, logger } = context;
    try {
        const formName = String(args?.form_name ?? '')
            .trim()
            .toUpperCase();
        if (!/^[ZY]/.test(formName))
            return (0, utils_1.return_error)(new Error('form_name must start with Z or Y'));
        const confirm = args?.confirm === true;
        logger?.info(`DeleteSmartForm: ${formName} (confirm=${confirm})`);
        let resp;
        try {
            resp = await (0, rfcBackend_1.callDispatch)(connection, 'SSF_DELETE_FORM', {
                form_name: formName,
                confirm: confirm ? 'X' : '',
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (/Unknown action:\s*SSF_DELETE_FORM/i.test(msg) ||
                /ZMCP_SSF_DELETE[\s\S]*not found/i.test(msg))
                throw new Error(`${exports.SSF_DELETE_INSTALL_HINT} (SAP said: ${msg})`);
            throw error;
        }
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
        logger?.error(`DeleteSmartForm error: ${errorMessage}`);
        return (0, utils_1.return_error)(new Error(errorMessage));
    }
}
//# sourceMappingURL=handleDeleteSmartForm.js.map