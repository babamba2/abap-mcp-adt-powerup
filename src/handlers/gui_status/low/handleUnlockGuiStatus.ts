/**
 * UnlockGuiStatus Handler - Unlock parent program after GUI Status modification
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  encodeSapObjectName,
  isCloudConnection,
  makeAdtRequestWithTimeout,
  restoreSessionInConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'UnlockGuiStatusLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Unlock a program after GUI Status modification. Requires lock handle from LockGuiStatusLow.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name.',
      },
      lock_handle: {
        type: 'string',
        description: 'Lock handle from LockGuiStatusLow.',
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
    required: ['program_name', 'lock_handle'],
  },
} as const;

interface UnlockGuiStatusArgs {
  program_name: string;
  lock_handle: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleUnlockGuiStatus(
  context: HandlerContext,
  args: UnlockGuiStatusArgs,
) {
  const { connection, logger } = context;
  try {
    const { program_name, lock_handle, session_id, session_state } = args;

    if (!program_name || !lock_handle) {
      return return_error(
        new Error('program_name and lock_handle are required'),
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
    const encodedProgram = encodeSapObjectName(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

    logger?.info(`Unlocking program for GUI status: ${programName}`);

    await makeAdtRequestWithTimeout(
      connection,
      `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lock_handle)}`,
      'POST',
      'default',
    );

    logger?.info(`✅ Program unlocked: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          session_id: session_id || null,
          message: `Program ${programName} unlocked successfully.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error unlocking for GUI status: ${errorMessage}`);
    return return_error(new Error(`Failed to unlock: ${errorMessage}`));
  }
}
