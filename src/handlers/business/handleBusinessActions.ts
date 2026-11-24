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

import { type BizMode, type BizResult, callBizExecute } from '../../lib/bizRfc';
import type { HandlerContext } from '../../lib/handlers/interfaces';
import { getActiveTier } from '../../lib/profile';
import { return_error } from '../../lib/utils';

const PARAMS_SCHEMA = {
  type: 'object',
  description:
    'Flat JSON object of action parameters (values as strings; item lists as arrays of strings), named as in the action catalog (configs/<module>/actions.json). Unknown names are refused by SAP.',
  additionalProperties: true,
} as const;

const ACTION_SCHEMA = {
  type: 'string',
  description:
    'Catalog action id, e.g. MM.PO.LIST_OPEN or MM.PO.SET_DELIVERY_COMPLETE.',
} as const;

export const ListBusinessActions_Tool = {
  name: 'ListBusinessActions',
  tool_profile: ['biz'] as const,
  description:
    '[read-only] List the business actions installed and active in SAP (ZMCP_BIZ registry: id, kind query/write, version). Use before offering an action to the user.',
  inputSchema: { type: 'object', properties: {}, required: [] },
} as const;

export const RunBusinessQuery_Tool = {
  name: 'RunBusinessQuery',
  tool_profile: ['biz'] as const,
  description:
    '[read-only] Run a query business action (e.g. open purchase orders) or a PRECHECK of a write action (configuration / status facts that would block it). Never changes SAP data.',
  inputSchema: {
    type: 'object',
    properties: {
      action: ACTION_SCHEMA,
      params: PARAMS_SCHEMA,
      precheck: {
        type: 'boolean',
        description:
          'true = run PRECHECK for a write action instead of QUERY. Default false.',
      },
    },
    required: ['action'],
  },
} as const;

export const PreviewBusinessAction_Tool = {
  name: 'PreviewBusinessAction',
  tool_profile: ['biz'] as const,
  description:
    '[preview] Simulate a write business action in SAP (BAPI test run or checks only) and return the before/after values plus a one-time confirmation token. Show the preview to the user and get an explicit yes before ExecuteBusinessAction. Blocked on PRD profiles.',
  inputSchema: {
    type: 'object',
    properties: { action: ACTION_SCHEMA, params: PARAMS_SCHEMA },
    required: ['action', 'params'],
  },
} as const;

export const ExecuteBusinessAction_Tool = {
  name: 'ExecuteBusinessAction',
  tool_profile: ['biz'] as const,
  description:
    '[write] Execute a previewed write business action (BAPI + commit) in SAP. Needs the token from PreviewBusinessAction and exactly the same params; the token expires and works once. Only after the user confirmed the preview. Blocked on PRD profiles.',
  inputSchema: {
    type: 'object',
    properties: {
      action: ACTION_SCHEMA,
      params: PARAMS_SCHEMA,
      token: {
        type: 'string',
        description:
          'Token returned by PreviewBusinessAction for these params.',
      },
      idem_key: {
        type: 'string',
        description:
          'Optional idempotency key: repeating EXECUTE with the same key returns the stored result instead of posting again.',
      },
    },
    required: ['action', 'params', 'token'],
  },
} as const;

/** Tool names that may change SAP business data (blocked on PRD). */
export const BUSINESS_WRITE_TOOL_NAMES = [
  PreviewBusinessAction_Tool.name,
  ExecuteBusinessAction_Tool.name,
] as const;

function asParams(v: unknown): Record<string, unknown> {
  if (v === undefined || v === null) return {};
  if (typeof v === 'string') {
    const parsed = JSON.parse(v);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('params must be a JSON object');
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  throw new Error('params must be a JSON object');
}

export function formatBizResult(mode: BizMode, r: BizResult) {
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

function refuseOnPrd(tool: string): Error | null {
  if (getActiveTier() === 'PRD') {
    return new Error(
      `${tool} is blocked on a PRD-tier profile: business writes run only on DEV / QA.`,
    );
  }
  return null;
}

async function run(
  context: HandlerContext,
  mode: BizMode,
  args: any,
  extra: { token?: string; idemKey?: string } = {},
) {
  const action = String(args?.action ?? '').trim();
  if (mode !== 'LIST' && !action) {
    return return_error(new Error('action is required'));
  }
  const params = asParams(args?.params);
  const r = await callBizExecute(context.connection, {
    action,
    mode,
    params,
    ...extra,
  });
  return formatBizResult(mode, r);
}

export async function handleListBusinessActions(
  context: HandlerContext,
  _args: any,
) {
  try {
    return await run(context, 'LIST', {});
  } catch (e) {
    return return_error(e);
  }
}

export async function handleRunBusinessQuery(
  context: HandlerContext,
  args: any,
) {
  try {
    return await run(
      context,
      args?.precheck === true ? 'PRECHECK' : 'QUERY',
      args,
    );
  } catch (e) {
    return return_error(e);
  }
}

export async function handlePreviewBusinessAction(
  context: HandlerContext,
  args: any,
) {
  try {
    const blocked = refuseOnPrd(PreviewBusinessAction_Tool.name);
    if (blocked) return return_error(blocked);
    return await run(context, 'PREVIEW', args);
  } catch (e) {
    return return_error(e);
  }
}

export async function handleExecuteBusinessAction(
  context: HandlerContext,
  args: any,
) {
  try {
    const blocked = refuseOnPrd(ExecuteBusinessAction_Tool.name);
    if (blocked) return return_error(blocked);
    const token = String(args?.token ?? '').trim();
    if (!token) {
      return return_error(
        new Error(
          'token is required: run PreviewBusinessAction first and confirm it with the user',
        ),
      );
    }
    return await run(context, 'EXECUTE', args, {
      token,
      idemKey: args?.idem_key ? String(args.idem_key) : undefined,
    });
  } catch (e) {
    return return_error(e);
  }
}
