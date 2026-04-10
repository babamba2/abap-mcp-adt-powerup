/**
 * CreateGuiStatus Handler (High-level) - Create a new ABAP GUI Status
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP. Fetches existing CUA data,
 * adds the new status entry, writes back, and optionally activates.
 */

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

export const TOOL_DEFINITION = {
  name: 'CreateGuiStatus',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Create a new ABAP GUI Status on an existing program. Optionally activates after creation.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., Z_MY_PROGRAM).',
      },
      status_name: {
        type: 'string',
        description: 'GUI Status name to create (e.g., MAIN_STATUS).',
      },
      description: {
        type: 'string',
        description: 'GUI Status description.',
      },
      status_type: {
        type: 'string',
        description:
          'Status type: "N" (normal/dialog), "P" (popup), "C" (context menu). Default: "N".',
        enum: ['N', 'P', 'C'],
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
      activate: {
        type: 'boolean',
        description: 'Activate after creation. Default: false.',
      },
    },
    required: ['program_name', 'status_name'],
  },
} as const;

interface CreateGuiStatusArgs {
  program_name: string;
  status_name: string;
  description?: string;
  status_type?: string;
  transport_request?: string;
  activate?: boolean;
}

export async function handleCreateGuiStatus(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: CreateGuiStatusArgs = params;

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
  const shouldActivate = args.activate === true;

  logger?.info(`Creating GUI status: ${programName} / ${statusName}`);

  try {
    // Fetch existing CUA data (may not exist yet)
    let cuaData: any = {
      sta: [],
      fun: [],
      men: [],
      mtx: [],
      act: [],
      but: [],
      pfk: [],
      set: [],
      doc: [],
      tit: [],
      biv: [],
      adm: {},
    };
    try {
      const { result } = await callDispatch(connection, 'CUA_FETCH', {
        program: programName,
      });
      cuaData = result;
    } catch {
      // No existing CUA data - start fresh
    }

    // Add new status entry
    const newStatus = {
      CODE: statusName,
      MODAL: args.status_type || 'N',
      TXT: args.description || `Status ${statusName}`,
    };
    cuaData.sta = cuaData.sta || [];
    cuaData.sta.push(newStatus);

    // Write back
    await callDispatch(connection, 'CUA_WRITE', {
      program: programName,
      cua_data: JSON.stringify(cuaData),
    });

    logger?.info(`GUI status created: ${programName}/${statusName}`);

    // Activate if requested
    if (shouldActivate) {
      const encodedProgram = encodeSapObjectName(programName);
      const programUri = `/sap/bc/adt/programs/programs/${encodedProgram}`;
      const activationXml = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programUri}" adtcore:name="${programName}"/></adtcore:objectReferences>`;

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
      logger?.info(`Program activated: ${programName}`);
    }

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          status_name: statusName,
          status_type: args.status_type || 'N',
          type: 'CUAD',
          activated: shouldActivate,
          message: shouldActivate
            ? `GUI Status ${programName}/${statusName} created and activated.`
            : `GUI Status ${programName}/${statusName} created (not activated).`,
          steps_completed: ['create', ...(shouldActivate ? ['activate'] : [])],
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error creating GUI status: ${errorMessage}`);
    return return_error(
      new Error(`Failed to create GUI status: ${errorMessage}`),
    );
  }
}
