/**
 * UpdateScreen Handler (Low-level) - Update ABAP Screen flow logic via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Deletes + re-inserts screen
 * since RPY_DYNPRO_INSERT is the standard update mechanism.
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
  name: 'UpdateScreenLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      screen_number: {
        type: 'string',
        description: 'Screen number (e.g., 0100).',
      },
      dynpro_data: {
        type: 'string',
        description:
          'Complete screen definition as JSON (header, containers, fields_to_containers, flow_logic).',
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
    required: ['program_name', 'screen_number', 'dynpro_data', 'lock_handle'],
  },
} as const;

interface UpdateScreenArgs {
  program_name: string;
  screen_number: string;
  dynpro_data: string;
  lock_handle: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleUpdateScreen(
  context: HandlerContext,
  args: UpdateScreenArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      program_name,
      screen_number,
      dynpro_data,
      lock_handle,
      session_id,
      session_state,
    } = args;
    if (!program_name || !screen_number || !dynpro_data || !lock_handle) {
      return return_error(
        new Error(
          'program_name, screen_number, dynpro_data, and lock_handle are required',
        ),
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
    logger?.info(`Updating screen: ${programName} / ${screen_number}`);

    // Delete existing screen first, then re-insert with new data
    try {
      await callDispatch(connection, 'DYNPRO_DELETE', {
        program: programName,
        dynpro: screen_number,
      });
    } catch {
      // Screen might not exist yet - that's ok for insert
    }

    await callDispatch(connection, 'DYNPRO_INSERT', {
      program: programName,
      dynpro: screen_number,
      dynpro_data: dynpro_data,
    });

    logger?.info(`✅ Screen updated: ${programName}/${screen_number}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number,
          session_id: session_id || null,
          message: `Screen ${programName}/${screen_number} updated successfully. Remember to unlock and activate.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error updating screen: ${errorMessage}`);
    return return_error(new Error(`Failed to update screen: ${errorMessage}`));
  }
}
