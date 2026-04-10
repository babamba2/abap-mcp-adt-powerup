/**
 * ReadGuiStatus Handler - Read ABAP GUI Status definition
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_INTERNAL_FETCH.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/soapRfc';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ReadGuiStatus',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only] Read ABAP GUI Status definition (statuses, function codes, menus, toolbars, titles) for a program.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., SAPMV45A).',
      },
    },
    required: ['program_name'],
  },
} as const;

export async function handleReadGuiStatus(
  context: HandlerContext,
  args: { program_name: string },
) {
  const { connection, logger } = context;
  try {
    if (!args.program_name) {
      return return_error(new Error('program_name is required'));
    }

    if (isCloudConnection()) {
      return return_error(
        new Error(
          'GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
        ),
      );
    }

    const programName = args.program_name.toUpperCase();
    logger?.info(`Reading GUI status data for program: ${programName}`);

    const { result } = await callDispatch(connection, 'CUA_FETCH', {
      program: programName,
    });

    logger?.info(`✅ ReadGuiStatus completed: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          definition: result,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error reading GUI status: ${errorMessage}`);
    return return_error(new Error(errorMessage));
  }
}
