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

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { getStandardText } from '../../../lib/smartFormContent';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetStandardText',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only, DEV profiles only] Read one SAPscript standard text (SO10, text object TEXT) — the lines with their paragraph formats, as READ_TEXT returns them. For include texts that forms print (e.g. an Adobe or SmartForm include text with a fixed name). Business document texts (other text objects) are not reachable. Needs the ZMCP_SSF_CONTENT FM and the SSF_CONTENT dispatcher action.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Standard text name as in SO10 (e.g. "SAPSCRIPT-DRUCKERTEST").',
      },
      text_id: {
        type: 'string',
        description: 'Text ID (default ST).',
      },
      language: {
        type: 'string',
        description:
          '1-character SAP language key (E, D, …); empty = logon language.',
      },
    },
    required: ['name'],
  },
} as const;

export async function handleGetStandardText(
  context: HandlerContext,
  args: { name: string; text_id?: string; language?: string },
) {
  const { connection, logger } = context;
  try {
    logger?.info(`GetStandardText: ${args?.name}`);
    const result = await getStandardText(
      connection,
      args?.name,
      args?.text_id || 'ST',
      args?.language ?? '',
    );
    return return_response({
      data: JSON.stringify(result, null, 2),
    } as AxiosResponse);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.error(`GetStandardText error: ${msg}`);
    return return_error(new Error(msg));
  }
}
