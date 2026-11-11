"use strict";
/**
 * Business-action tools (tool profile "biz"): ListBusinessActions,
 * RunBusinessQuery, PreviewBusinessAction, ExecuteBusinessAction.
 *
 * All four call ZMCP_BIZ_EXECUTE (see lib/bizRfc.ts). Safety is enforced in
 * SAP (whitelist, AUTHORITY-CHECK, preview token bound to user + parameter
 * hash, production-client block, ZMCP_BIZ_LOG). This layer adds the first
 * block: Preview / Execute are refused on a PRD-tier profile (also in
 * readonlyGuard), and Execute without a token is refused before any call.
 *
 * Companion ABAP: sc4sap/abap/biz/ (ZMCP_BIZ_EXECUTE, ZCL_MCP_BIZ_*).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_WRITE_TOOL_NAMES = exports.ExecuteBusinessAction_Tool = exports.PreviewBusinessAction_Tool = exports.RunBusinessQuery_Tool = exports.ListBusinessActions_Tool = void 0;
exports.formatBizResult = formatBizResult;
exports.handleListBusinessActions = handleListBusinessActions;
exports.handleRunBusinessQuery = handleRunBusinessQuery;
exports.handlePreviewBusinessAction = handlePreviewBusinessAction;
exports.handleExecuteBusinessAction = handleExecuteBusinessAction;
const bizRfc_1 = require("../../lib/bizRfc");
const profile_1 = require("../../lib/profile");
const utils_1 = require("../../lib/utils");
const PARAMS_SCHEMA = {
    type: 'object',
    description: 'Flat JSON object of action parameters (values as strings; item lists as arrays of strings), named as in the action catalog (configs/<module>/actions.json). Unknown names are refused by SAP.',
    additionalProperties: true,
};
const ACTION_SCHEMA = {
    type: 'string',
    description: 'Catalog action id, e.g. MM.PO.LIST_OPEN or MM.PO.SET_DELIVERY_COMPLETE.',
};
exports.ListBusinessActions_Tool = {
    name: 'ListBusinessActions',
    tool_profile: ['biz'],
    description: '[read-only] List the business actions installed and active in SAP (ZMCP_BIZ registry: id, kind query/write, version). Use before offering an action to the user.',
    inputSchema: { type: 'object', properties: {}, required: [] },
};
exports.RunBusinessQuery_Tool = {
    name: 'RunBusinessQuery',
    tool_profile: ['biz'],
    description: '[read-only] Run a query business action (e.g. open purchase orders) or a PRECHECK of a write action (configuration / status facts that would block it). Never changes SAP data.',
    inputSchema: {
        type: 'object',
        properties: {
            action: ACTION_SCHEMA,
            params: PARAMS_SCHEMA,
            precheck: {
                type: 'boolean',
                description: 'true = run PRECHECK for a write action instead of QUERY. Default false.',
            },
        },
        required: ['action'],
    },
};
exports.PreviewBusinessAction_Tool = {
    name: 'PreviewBusinessAction',
    tool_profile: ['biz'],
    description: '[preview] Simulate a write business action in SAP (BAPI test run or checks only) and return the before/after values plus a one-time confirmation token. Show the preview to the user and get an explicit yes before ExecuteBusinessAction. Blocked on PRD profiles.',
    inputSchema: {
        type: 'object',
        properties: { action: ACTION_SCHEMA, params: PARAMS_SCHEMA },
        required: ['action', 'params'],
    },
};
exports.ExecuteBusinessAction_Tool = {
    name: 'ExecuteBusinessAction',
    tool_profile: ['biz'],
    description: '[write] Execute a previewed write business action (BAPI + commit) in SAP. Needs the token from PreviewBusinessAction and exactly the same params; the token expires and works once. Only after the user confirmed the preview. Blocked on PRD profiles.',
    inputSchema: {
        type: 'object',
        properties: {
            action: ACTION_SCHEMA,
            params: PARAMS_SCHEMA,
            token: {
                type: 'string',
                description: 'Token returned by PreviewBusinessAction for these params.',
            },
            idem_key: {
                type: 'string',
                description: 'Optional idempotency key: repeating EXECUTE with the same key returns the stored result instead of posting again.',
            },
        },
        required: ['action', 'params', 'token'],
    },
};
/** Tool names that may change SAP business data (blocked on PRD). */
exports.BUSINESS_WRITE_TOOL_NAMES = [
    exports.PreviewBusinessAction_Tool.name,
    exports.ExecuteBusinessAction_Tool.name,
];
function asParams(v) {
    if (v === undefined || v === null)
        return {};
    if (typeof v === 'string') {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        throw new Error('params must be a JSON object');
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
        return v;
    }
    throw new Error('params must be a JSON object');
}
function formatBizResult(mode, r) {
    const body = {
        ok: r.subrc === 0,
        mode,
        subrc: r.subrc,
        message: r.message,
        ...(r.token ? { token: r.token } : {}),
        result: r.result,
    };
    return {
        isError: false,
        content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    };
}
function refuseOnPrd(tool) {
    if ((0, profile_1.getActiveTier)() === 'PRD') {
        return new Error(`${tool} is blocked on a PRD-tier profile: business writes run only on DEV / QA.`);
    }
    return null;
}
async function run(context, mode, args, extra = {}) {
    const action = String(args?.action ?? '').trim();
    if (mode !== 'LIST' && !action) {
        return (0, utils_1.return_error)(new Error('action is required'));
    }
    const params = asParams(args?.params);
    const r = await (0, bizRfc_1.callBizExecute)(context.connection, {
        action,
        mode,
        params,
        ...extra,
    });
    return formatBizResult(mode, r);
}
async function handleListBusinessActions(context, _args) {
    try {
        return await run(context, 'LIST', {});
    }
    catch (e) {
        return (0, utils_1.return_error)(e);
    }
}
async function handleRunBusinessQuery(context, args) {
    try {
        return await run(context, args?.precheck === true ? 'PRECHECK' : 'QUERY', args);
    }
    catch (e) {
        return (0, utils_1.return_error)(e);
    }
}
async function handlePreviewBusinessAction(context, args) {
    try {
        const blocked = refuseOnPrd(exports.PreviewBusinessAction_Tool.name);
        if (blocked)
            return (0, utils_1.return_error)(blocked);
        return await run(context, 'PREVIEW', args);
    }
    catch (e) {
        return (0, utils_1.return_error)(e);
    }
}
async function handleExecuteBusinessAction(context, args) {
    try {
        const blocked = refuseOnPrd(exports.ExecuteBusinessAction_Tool.name);
        if (blocked)
            return (0, utils_1.return_error)(blocked);
        const token = String(args?.token ?? '').trim();
        if (!token) {
            return (0, utils_1.return_error)(new Error('token is required: run PreviewBusinessAction first and confirm it with the user'));
        }
        return await run(context, 'EXECUTE', args, {
            token,
            idemKey: args?.idem_key ? String(args.idem_key) : undefined,
        });
    }
    catch (e) {
        return (0, utils_1.return_error)(e);
    }
}
//# sourceMappingURL=handleBusinessActions.js.map