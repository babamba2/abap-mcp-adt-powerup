/**
 * GetAdobeFormContent — read-only: an Adobe form (SFP) for a preview.
 *
 * The form header (interface, form type, layout technology), the whole form
 * as XML (the SFP download format: context tree, texts, layout), the layout
 * alone (XDP / XFA template) and the form interface XML, written under the
 * MCP output directory (adobe/<form>/), plus counts from the XDP.
 *
 * Backend: ZMCP_ADT_DISPATCH action FP_CONTENT → FM ZMCP_FP_CONTENT
 * (CL_FP_WB_FORM=>LOAD in display mode, CL_FP_HELPER convert-to-xstring).
 * Companion ABAP: sc4sap/abap/zmcp_fp_content.abap
 */

import { getAdobeFormContent } from '../../../lib/adobeForm';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetAdobeFormContent',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only] Read an Adobe form (transaction SFP) for a preview: the header (interface, form type, layout technology), the whole form as XML (SFP download format: context tree, texts, layout), the layout alone as XDP / XFA template and the form interface as XML — written as files under the MCP output directory (adobe/<form>/: <form>.form.json, <form>.form.xml, <form>.layout.xdp, <interface>.interface.xml) — and counts from the XDP (page areas, subforms, fields, draws, data bindings, scripts). Active version. Needs the ZMCP_FP_CONTENT FM and the FP_CONTENT dispatcher action (development clients only).',
  inputSchema: {
    type: 'object',
    properties: {
      form_name: {
        type: 'string',
        description: 'Adobe form name (e.g. "FP_TEST_00").',
      },
      language: {
        type: 'string',
        description:
          'Text language: 1-char SAP key or 2-letter ISO code. Default: logon language.',
      },
      include_interface: {
        type: 'boolean',
        description: 'Also read the form interface XML. Default true.',
      },
    },
    required: ['form_name'],
  },
} as const;

export async function handleGetAdobeFormContent(
  context: HandlerContext,
  args: { form_name: string; language?: string; include_interface?: boolean },
) {
  const { connection, logger } = context;
  try {
    if (!String(args?.form_name ?? '').trim())
      return return_error(new Error('form_name is required'));
    logger?.info(`GetAdobeFormContent: ${args.form_name}`);
    const content = await getAdobeFormContent(connection, args.form_name, {
      language: args?.language?.trim() || undefined,
      includeInterface: args?.include_interface,
    });
    return return_response({
      data: JSON.stringify(content, null, 2),
    } as AxiosResponse);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`GetAdobeFormContent error: ${errorMessage}`);
    return return_error(new Error(errorMessage));
  }
}
