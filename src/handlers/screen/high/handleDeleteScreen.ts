/**
 * DeleteScreen Handler (High-level) - Delete an ABAP Screen via RFC
 *
 * Locks program, deletes screen via RFC, unlocks.
 */

import { XMLParser } from 'fast-xml-parser';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  encodeSapObjectName,
  isCloudConnection,
  makeAdtRequestWithTimeout,
  return_error,
  return_response,
} from '../../../lib/utils';

const ACCEPT_LOCK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9';

export const TOOL_DEFINITION = {
  name: 'DeleteScreen',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Delete an ABAP Screen (Dynpro) from a program. Handles lock/unlock automatically.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      screen_number: {
        type: 'string',
        description: 'Screen number to delete.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
    },
    required: ['program_name', 'screen_number'],
  },
} as const;

interface DeleteScreenArgs {
  program_name: string;
  screen_number: string;
  transport_request?: string;
}

export async function handleDeleteScreen(context: HandlerContext, params: any) {
  const { connection, logger } = context;
  const args: DeleteScreenArgs = params;

  if (!args.program_name || !args.screen_number) {
    return return_error(
      new Error('Missing required parameters: program_name and screen_number'),
    );
  }
  if (isCloudConnection()) {
    return return_error(
      new Error('Screens are not available on cloud systems (ABAP Cloud).'),
    );
  }

  const programName = args.program_name.toUpperCase();
  const encodedProgram = encodeSapObjectName(programName);
  const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

  logger?.info(`Deleting screen: ${programName}/${args.screen_number}`);

  let lockHandle: string | undefined;

  try {
    // Lock program
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
    lockHandle =
      parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE ||
      lockResponse.headers?.['x-sap-adt-lock-handle'];

    // Delete via RFC
    await callDispatch(connection, 'DYNPRO_DELETE', {
      program: programName,
      dynpro: args.screen_number,
    });

    // Unlock
    if (lockHandle) {
      await makeAdtRequestWithTimeout(
        connection,
        `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
        'POST',
        'default',
      );
      lockHandle = undefined;
    }

    logger?.info(`✅ Screen deleted: ${programName}/${args.screen_number}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number: args.screen_number,
          message: `Screen ${programName}/${args.screen_number} deleted successfully.`,
          steps_completed: ['lock', 'delete', 'unlock'],
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
    if (lockHandle) {
      try {
        await makeAdtRequestWithTimeout(
          connection,
          `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
          'POST',
          'default',
        );
      } catch {
        /* ignore */
      }
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error deleting screen: ${errorMessage}`);
    return return_error(new Error(`Failed to delete screen: ${errorMessage}`));
  }
}
