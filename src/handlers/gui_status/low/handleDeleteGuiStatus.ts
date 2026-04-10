/**
 * DeleteGuiStatus Handler - Delete an ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RS_CUA_DELETE.
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
  name: 'DeleteGuiStatusLow',
  available_in: ['onprem', 'legacy'] as const,
  description: '[low-level] Delete an ABAP GUI Status from a program.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name.',
      },
      status_name: {
        type: 'string',
        description: 'GUI Status name to delete. Use "*" to delete all.',
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
    required: ['program_name', 'status_name', 'lock_handle'],
  },
} as const;

interface DeleteGuiStatusArgs {
  program_name: string;
  status_name: string;
  lock_handle: string;
  transport_request?: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleDeleteGuiStatus(
  context: HandlerContext,
  args: DeleteGuiStatusArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      program_name,
      status_name,
      lock_handle,
      session_id,
      session_state,
    } = args;

    if (!program_name || !status_name || !lock_handle) {
      return return_error(
        new Error('program_name, status_name, and lock_handle are required'),
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
    const statusName = status_name.toUpperCase();

    logger?.info(`Deleting GUI status: ${programName} / ${statusName}`);

    await callDispatch(connection, 'CUA_DELETE', {
      program: programName,
      status: statusName,
    });

    logger?.info(`✅ GUI status deleted: ${programName}/${statusName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          status_name: statusName,
          session_id: session_id || null,
          message: `GUI Status ${programName}/${statusName} deleted successfully.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error deleting GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to delete GUI status: ${errorMessage}`),
    );
  }
}
