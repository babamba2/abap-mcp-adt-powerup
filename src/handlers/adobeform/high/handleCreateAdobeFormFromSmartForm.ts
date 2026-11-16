/**
 * CreateAdobeFormFromSmartForm — SAP's SmartForm → Adobe form migration (CL_SSF_MIGRATION's steps) of a SAP
 * example SmartForm into NEW local objects (ZSC4SAP_AFM_* form and interface, package $TMP), activated, with
 * SAP's migration log. Development systems only: the Create prefix makes the server's tier guard and the
 * plugin hook refuse it on QA / PRD; the SAP helper refuses non-development clients itself.
 *
 * SAP side: ZMCP_ADT_DISPATCH action FP_MIGRATE → FM ZMCP_FP_MIGRATE.
 * Companion ABAP: sc4sap/abap/zmcp_fp_migrate.abap, zmcp_adt_dispatch_fp_migrate_branch.abap.
 */

import { createAdobeFormFromSmartForm } from '../../../lib/adobeForm';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'CreateAdobeFormFromSmartForm',
  available_in: ['onprem', 'legacy'] as const,
  description:
    "[writes, DEV only] Migrate a SAP-delivered SmartForm into a NEW Adobe form and interface with SAP's own migration (CL_SSF_MIGRATION steps, all options except 'alternative: true branch' and 'text placeholder'), in package $TMP, activated. Target names must match ZSC4SAP_AFM_* and must not exist — nothing is overwritten or deleted. Returns SAP's migration log, the options used and what was saved / activated; `complete` is true only when both objects are active (otherwise `message` says what is not). When SAP's migration raises, the tool fails and its error names the objects left behind (delete them only with the user's approval). Needs the ZMCP_FP_MIGRATE FM and the FP_MIGRATE dispatcher action.",
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description:
          'SAP SmartForm to migrate (e.g. "SF_EXAMPLE_01"); customer forms are refused.',
      },
      form_name: {
        type: 'string',
        description: 'New Adobe form name, ZSC4SAP_AFM_* (≤ 30).',
      },
      interface_name: {
        type: 'string',
        description: 'New form interface name, ZSC4SAP_AFM_* (≤ 30).',
      },
      sender_country: {
        type: 'string',
        description:
          'Optional country key (T005, e.g. "DE") set as sender country on address nodes that have none — the Adobe check requires one, SmartForms did not. Without it nothing is changed and the check reports the address nodes.',
      },
    },
    required: ['source', 'form_name', 'interface_name'],
  },
} as const;

export async function handleCreateAdobeFormFromSmartForm(
  context: HandlerContext,
  args: {
    source: string;
    form_name: string;
    interface_name: string;
    sender_country?: string;
  },
) {
  const { connection, logger } = context;
  try {
    logger?.info(
      `CreateAdobeFormFromSmartForm: ${args?.source} → ${args?.form_name}`,
    );
    const result = await createAdobeFormFromSmartForm(
      connection,
      args?.source,
      args?.form_name,
      args?.interface_name,
      args?.sender_country,
    );
    return return_response({
      data: JSON.stringify(result, null, 2),
    } as AxiosResponse);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.error(`CreateAdobeFormFromSmartForm error: ${msg}`);
    return return_error(new Error(msg));
  }
}
