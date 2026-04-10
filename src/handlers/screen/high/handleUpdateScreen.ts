/**
 * UpdateScreen Handler (High-level) - Update ABAP Screen via RFC
 *
 * Locks program, deletes+re-inserts screen via RFC, unlocks, optionally activates.
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
  name: 'UpdateScreen',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Update an ABAP Screen (Dynpro) definition. Provide full screen data as JSON. Handles lock/unlock automatically.',
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
          'Complete screen definition as JSON (from GetScreen/ReadScreen).',
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
    required: ['program_name', 'screen_number', 'dynpro_data'],
  },
} as const;

interface UpdateScreenArgs {
  program_name: string;
  screen_number: string;
  dynpro_data: string;
  transport_request?: string;
  activate?: boolean;
}

export async function handleUpdateScreen(context: HandlerContext, params: any) {
  const { connection, logger } = context;
  const args: UpdateScreenArgs = params;

  if (!args.program_name || !args.screen_number || !args.dynpro_data) {
    return return_error(
      new Error(
        'Missing required parameters: program_name, screen_number, and dynpro_data',
      ),
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
  const shouldActivate = args.activate === true;

  logger?.info(`Updating screen: ${programName}/${args.screen_number}`);

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

    // Delete + re-insert screen via RFC
    try {
      await callDispatch(connection, 'DYNPRO_DELETE', {
        program: programName,
        dynpro: args.screen_number,
      });
    } catch {
      /* screen might not exist */
    }

    await callDispatch(connection, 'DYNPRO_INSERT', {
      program: programName,
      dynpro: args.screen_number,
      dynpro_data: args.dynpro_data,
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

    // Activate
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

    logger?.info(`✅ Screen updated: ${programName}/${args.screen_number}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number: args.screen_number,
          type: 'DYNP',
          activated: shouldActivate,
          message: shouldActivate
            ? `Screen ${programName}/${args.screen_number} updated and activated.`
            : `Screen ${programName}/${args.screen_number} updated (not activated).`,
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
        /* ignore */
      }
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error updating screen: ${errorMessage}`);
    return return_error(new Error(`Failed to update screen: ${errorMessage}`));
  }
}
