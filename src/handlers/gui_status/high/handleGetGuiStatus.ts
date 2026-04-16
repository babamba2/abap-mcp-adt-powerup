/**
 * GetGuiStatus Handler - Get ABAP GUI Status definition
 *
 * High-level handler: retrieves GUI status definition with structured data.
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_INTERNAL_FETCH.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetGuiStatus',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Get ABAP GUI Status definition including statuses, function codes, menus, toolbars, and titles.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., SAPMV45A).',
      },
      status_name: {
        type: 'string',
        description:
          'Optional: filter to a specific GUI Status name. If omitted, returns all statuses.',
      },
    },
    required: ['program_name'],
  },
} as const;

export async function handleGetGuiStatus(context: HandlerContext, params: any) {
  const { connection, logger } = context;
  const args = params as { program_name: string; status_name?: string };

  if (!args.program_name) {
    return return_error(new Error('Missing required parameter: program_name'));
  }

  if (isCloudConnection()) {
    return return_error(
      new Error(
        'GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
      ),
    );
  }

  const programName = args.program_name.toUpperCase();
  const statusName = args.status_name?.toUpperCase();

  logger?.info(
    `Getting GUI status: ${programName}${statusName ? ` / ${statusName}` : ''}`,
  );

  try {
    const { result } = await callDispatch(connection, 'CUA_FETCH', {
      program: programName,
    });

    // If a specific status was requested, filter the results.
    // /ui2/cl_json=>serialize default keeps ABAP field names UPPERCASE.
    let filteredResult = result;
    const staArr = result?.STA ?? result?.sta;
    if (statusName && Array.isArray(staArr)) {
      const filteredSta = staArr.filter(
        (s: any) => s.CODE === statusName || s.code === statusName,
      );
      filteredResult = { ...result, STA: filteredSta };
    }

    logger?.info(`✅ GetGuiStatus completed: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          status_name: statusName || null,
          type: 'CUAD',
          definition: filteredResult,
          steps_completed: ['get_definition'],
        },
        null,
        2,
      ),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error getting GUI status: ${errorMessage}`);
    return return_error(new Error(`Failed to get GUI status: ${errorMessage}`));
  }
}
