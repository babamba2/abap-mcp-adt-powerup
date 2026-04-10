/**
 * DeleteScreen Handler (Low-level) - Delete an ABAP Screen via RFC
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
  name: 'DeleteScreenLow',
  available_in: ['onprem', 'legacy'] as const,
  description: '[low-level] Delete an ABAP Screen (Dynpro) from a program.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      screen_number: {
        type: 'string',
        description: 'Screen number (e.g., 0100).',
      },
      lock_handle: {
        type: 'string',
        description: 'Lock handle from LockScreenLow.',
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
    required: ['program_name', 'screen_number', 'lock_handle'],
  },
} as const;

interface DeleteScreenArgs {
  program_name: string;
  screen_number: string;
  lock_handle: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleDeleteScreen(
  context: HandlerContext,
  args: DeleteScreenArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      program_name,
      screen_number,
      lock_handle,
      session_id,
      session_state,
    } = args;
    if (!program_name || !screen_number || !lock_handle) {
      return return_error(
        new Error('program_name, screen_number, and lock_handle are required'),
      );
    }
    if (isCloudConnection()) {
      return return_error(
        new Error('Screens are not available on cloud systems (ABAP Cloud).'),
      );
    }
    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    }

    const programName = program_name.toUpperCase();
    logger?.info(`Deleting screen: ${programName} / ${screen_number}`);

    await callDispatch(connection, 'DYNPRO_DELETE', {
      program: programName,
      dynpro: screen_number,
    });

    logger?.info(`✅ Screen deleted: ${programName}/${screen_number}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number,
          session_id: session_id || null,
          message: `Screen ${programName}/${screen_number} deleted successfully.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error deleting screen: ${errorMessage}`);
    return return_error(new Error(`Failed to delete screen: ${errorMessage}`));
  }
}
