/**
 * UpdateGuiStatus Handler - Update an ABAP GUI Status definition
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Accepts full CUA data as JSON
 * and writes it via RS_CUA_INTERNAL_WRITE.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/soapRfc';
import {
  type AxiosResponse,
  isCloudConnection,
  restoreSessionInConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'UpdateGuiStatusLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Update an ABAP GUI Status definition. Provide full CUA data (from ReadGuiStatus) with modifications.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name.',
      },
      cua_data: {
        type: 'string',
        description:
          'Complete CUA data as JSON string (from ReadGuiStatus/GetGuiStatus). Modify and pass back.',
      },
      lock_handle: {
        type: 'string',
        description: 'Lock handle from LockGuiStatusLow.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
      session_id: {
        type: 'string',
        description: 'Session ID from GetSession.',
      },
      session_state: {
        type: 'object',
        description: 'Session state from GetSession.',
        properties: {
          cookies: { type: 'string' },
          csrf_token: { type: 'string' },
          cookie_store: { type: 'object' },
        },
      },
    },
    required: ['program_name', 'cua_data', 'lock_handle'],
  },
} as const;

interface UpdateGuiStatusArgs {
  program_name: string;
  cua_data: string;
  lock_handle: string;
  transport_request?: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleUpdateGuiStatus(
  context: HandlerContext,
  args: UpdateGuiStatusArgs,
) {
  const { connection, logger } = context;
  try {
    const { program_name, cua_data, lock_handle, session_id, session_state } =
      args;

    if (!program_name || !cua_data || !lock_handle) {
      return return_error(
        new Error('program_name, cua_data, and lock_handle are required'),
      );
    }

    if (isCloudConnection()) {
      return return_error(
        new Error(
          'GUI Statuses are not available on cloud systems (ABAP Cloud).',
        ),
      );
    }

    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    }

    const programName = program_name.toUpperCase();

    logger?.info(`Updating GUI status data: ${programName}`);

    await callDispatch(connection, 'CUA_WRITE', {
      program: programName,
      cua_data,
    });

    logger?.info(`✅ GUI status updated: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          session_id: session_id || null,
          message: `GUI Status data for ${programName} updated successfully. Remember to unlock and activate.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error updating GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to update GUI status: ${errorMessage}`),
    );
  }
}
