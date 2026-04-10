/**
 * DeleteGuiStatus Handler (High-level) - Delete an ABAP GUI Status
 *
 * Locks program, deletes via RFC, unlocks.
 */

import { XMLParser } from 'fast-xml-parser';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/soapRfc';
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
  name: 'DeleteGuiStatus',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Delete an ABAP GUI Status from a program. Handles lock/unlock automatically.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name.',
      },
      status_name: {
        type: 'string',
        description: 'GUI Status name to delete.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
    },
    required: ['program_name', 'status_name'],
  },
} as const;

interface DeleteGuiStatusArgs {
  program_name: string;
  status_name: string;
  transport_request?: string;
}

export async function handleDeleteGuiStatus(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: DeleteGuiStatusArgs = params;

  if (!args.program_name || !args.status_name) {
    return return_error(
      new Error('Missing required parameters: program_name and status_name'),
    );
  }

  if (isCloudConnection()) {
    return return_error(
      new Error(
        'GUI Statuses are not available on cloud systems (ABAP Cloud).',
      ),
    );
  }

  const programName = args.program_name.toUpperCase();
  const statusName = args.status_name.toUpperCase();
  const encodedProgram = encodeSapObjectName(programName);
  const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

  logger?.info(`Deleting GUI status: ${programName}/${statusName}`);

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
    await callDispatch(connection, 'CUA_DELETE', {
      program: programName,
      status: statusName,
    });

    // Unlock program
    if (lockHandle) {
      await makeAdtRequestWithTimeout(
        connection,
        `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
        'POST',
        'default',
      );
      lockHandle = undefined;
    }

    logger?.info(`✅ GUI status deleted: ${programName}/${statusName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          status_name: statusName,
          message: `GUI Status ${programName}/${statusName} deleted successfully.`,
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
    logger?.error(`Error deleting GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to delete GUI status: ${errorMessage}`),
    );
  }
}
