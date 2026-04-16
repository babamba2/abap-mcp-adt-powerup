/**
 * UpdateGuiStatus Handler (High-level) - Update ABAP GUI Status definition
 *
 * Locks program, writes CUA data via RFC, unlocks, optionally activates.
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
  name: 'UpdateGuiStatus',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Update ABAP GUI Status definition. Provide modified CUA data (from GetGuiStatus). Handles lock/unlock automatically.',
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
          'Complete CUA data as JSON (from GetGuiStatus). Modify and pass back.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
      activate: {
        type: 'boolean',
        description: 'Activate after update. Default: false.',
      },
    },
    required: ['program_name', 'cua_data'],
  },
} as const;

interface UpdateGuiStatusArgs {
  program_name: string;
  cua_data: string;
  transport_request?: string;
  activate?: boolean;
}

export async function handleUpdateGuiStatus(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: UpdateGuiStatusArgs = params;

  if (!args.program_name || !args.cua_data) {
    return return_error(
      new Error('Missing required parameters: program_name and cua_data'),
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
  const encodedProgram = encodeSapObjectName(programName);
  const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;
  const shouldActivate = args.activate === true;

  logger?.info(`Updating GUI status data: ${programName}`);

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

    if (!lockHandle) {
      throw new Error(
        `Failed to obtain lock handle for program ${programName}`,
      );
    }

    // Write CUA data via RFC
    await callDispatch(connection, 'CUA_WRITE', {
      program: programName,
      cua_data: args.cua_data,
    });

    // Unlock program
    await makeAdtRequestWithTimeout(
      connection,
      `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
      'POST',
      'default',
    );
    lockHandle = undefined;

    // Activate if requested
    if (shouldActivate) {
      const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUrl}" adtcore:name="${programName}"/></adtcore:objectReferences>`;

      await makeAdtRequestWithTimeout(
        connection,
        '/sap/bc/adt/activation',
        'POST',
        'long',
        activationXml,
        { method: 'activate', preauditRequested: 'true' },
        {
          'Content-Type':
            'application/vnd.sap.adt.activation.request+xml; charset=utf-8',
        },
      );
    }

    logger?.info(`✅ GUI status updated: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          type: 'CUAD',
          activated: shouldActivate,
          message: shouldActivate
            ? `GUI Status data for ${programName} updated and activated.`
            : `GUI Status data for ${programName} updated (not activated).`,
          steps_completed: [
            'lock',
            'update',
            'unlock',
            ...(shouldActivate ? ['activate'] : []),
          ],
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
        /* ignore unlock error */
      }
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error updating GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to update GUI status: ${errorMessage}`),
    );
  }
}
