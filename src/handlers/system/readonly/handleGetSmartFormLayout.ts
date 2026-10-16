/**
 * GetSmartFormLayout — read-only: pages and window positions of a SmartForm.
 *
 * Source: the Form Builder object model, read on the SAP side by
 * ZMCP_SSF_LAYOUT (CL_SSF_FB_SMART_FORM->LOAD in display mode, page tree,
 * window node output attributes). Only layout leaves SAP: no text node
 * contents, program lines, global data or form interface.
 *
 * Backend: ZMCP_ADT_DISPATCH action SSF_LAYOUT through callDispatch, so it
 * runs on the OData backend (BASIS 7.40) and on SOAP RFC (BASIS 7.31) alike.
 * Coordinates come back raw with their unit and are converted to mm here
 * (LN / CH through the page variant's LPI / CPI).
 *
 * Companion ABAP sources: sc4sap/abap/zmcp_ssf_layout.abap and
 * sc4sap/abap/zmcp_adt_dispatch_ssf_layout_branch.abap
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  getSmartFormLayout,
  normalizeSmartFormLanguage,
} from '../../../lib/smartFormLayout';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetSmartFormLayout',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only] Read the page and window layout of a SmartForm (active version; a never-activated form is read from its saved version, then `active` is false): per page the format, orientation, next page, CPI / LPI and style, and per window its type (MAIN / SECONDARY / ...), position and size as stored (value + unit) and converted to millimetres. Layout only: no texts, code or form interface. Needs the ZMCP_SSF_LAYOUT FM and the SSF_LAYOUT dispatcher action.',
  inputSchema: {
    type: 'object',
    properties: {
      form_name: {
        type: 'string',
        description: 'SmartForm name (e.g. "ZMY_FORM").',
      },
      language: {
        type: 'string',
        description:
          'Form language: 1-char SAP key (e.g. "E", "3") or 2-letter ISO code (e.g. "EN", "KO"). Default: the master language of the form.',
      },
    },
    required: ['form_name'],
  },
} as const;

export async function handleGetSmartFormLayout(
  context: HandlerContext,
  args: { form_name: string; language?: string },
) {
  const { connection, logger } = context;
  try {
    const formName = String(args?.form_name ?? '')
      .trim()
      .toUpperCase();
    if (!formName) {
      return return_error(new Error('form_name is required'));
    }
    let language: string;
    try {
      language = normalizeSmartFormLanguage(args?.language);
    } catch (e) {
      return return_error(e);
    }
    logger?.info(
      `GetSmartFormLayout: ${formName}, language=${language || '(master)'}`,
    );

    const layout = await getSmartFormLayout(connection, formName, language);

    return return_response({
      data: JSON.stringify(layout, null, 2),
    } as AxiosResponse);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`GetSmartFormLayout error: ${errorMessage}`);
    return return_error(new Error(errorMessage));
  }
}
