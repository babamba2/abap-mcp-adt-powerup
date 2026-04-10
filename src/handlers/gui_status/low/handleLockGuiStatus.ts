/**
 * LockGuiStatus Handler - Lock parent program for GUI Status modification
 *
 * Locks the parent program via ADT since GUI statuses don't have
 * their own ADT lock endpoints. Returns lock handle for update/delete.
 */

import { XMLParser } from 'fast-xml-parser';
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

const ACCEPT_LOCK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';

export const TOOL_DEFINITION = {
  name: 'LockGuiStatusLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Lock a program for GUI Status modification. Returns lock handle for subsequent update/unlock operations.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., SAPMV45A).',
      },
      status_name: {
        type: 'string',
        description: 'GUI Status name (for reference only).',
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
    required: ['program_name'],
  },
} as const;

interface LockGuiStatusArgs {
  program_name: string;
  status_name?: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleLockGuiStatus(
  context: HandlerContext,
  args: LockGuiStatusArgs,
) {
  const { connection, logger } = context;
  try {
    const { program_name, status_name, session_id, session_state } = args;

    if (!program_name) {
      return return_error(new Error('program_name is required'));
    }

    if (isCloudConnection()) {
      return return_error(
        new Error(
          'GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
        ),
      );
    }

    if (session_id && session_state) {
      await restoreSessionInConnection(connection, session_id, session_state);
    }

    const programName = program_name.toUpperCase();
    const encodedProgram = encodeSapObjectName(programName);
    const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

    logger?.info(`Locking program for GUI status: ${programName}`);

    const lockResponse = await makeAdtRequestWithTimeout(
      connection,
      `${programUrl}?_action=LOCK&accessMode=MODIFY`,
      'POST',
      'default',
      null,
      undefined,
      { Accept: ACCEPT_LOCK },
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const parsed = parser.parse(lockResponse.data || '');
    const lockHandle =
      parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
      lockResponse.headers?.['x-sap-adt-lock-handle'];

    if (!lockHandle) {
      throw new Error(
        `Failed to obtain lock handle for program ${programName}`,
      );
    }

    logger?.info(`✅ Program locked for GUI status: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          status_name: status_name?.toUpperCase() || null,
          session_id: session_id || null,
          lock_handle: lockHandle,
          session_state: null,
          message: `Program ${programName} locked for GUI status modification. Use this lock_handle for subsequent operations.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    if (error.response?.status === 409) {
      errorMessage = `Program ${args?.program_name} is already locked by another user.`;
    }
    logger?.error(`Error locking for GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to lock for GUI status: ${errorMessage}`),
    );
  }
}
