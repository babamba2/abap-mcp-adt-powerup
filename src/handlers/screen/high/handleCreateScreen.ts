/**
 * CreateScreen Handler (High-level) - Create a new ABAP Screen via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_INSERT.
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
  name: 'CreateScreen',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Create a new ABAP Screen (Dynpro) on an existing program. Optionally activates.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      screen_number: {
        type: 'string',
        description: 'Screen number to create (e.g., 0100).',
      },
      description: { type: 'string', description: 'Screen description.' },
      dynpro_data: {
        type: 'string',
        description:
          'Full screen definition as JSON. If omitted, creates minimal screen.',
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
    required: ['program_name', 'screen_number'],
  },
} as const;

interface CreateScreenArgs {
  program_name: string;
  screen_number: string;
  description?: string;
  dynpro_data?: string;
  transport_request?: string;
  activate?: boolean;
}

export async function handleCreateScreen(context: HandlerContext, params: any) {
  const { connection, logger } = context;
  const args: CreateScreenArgs = params;

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
  const shouldActivate = args.activate === true;

  logger?.info(`Creating screen: ${programName} / ${args.screen_number}`);

  try {
    const screenData =
      args.dynpro_data ||
      JSON.stringify({
        header: {
          PROGRAM: programName,
          SCREEN: args.screen_number,
          LANGUAGE: 'E',
          DESSION: args.description || `Screen ${args.screen_number}`,
          TYPE: 'N',
          LINES: '20',
          COLUMNS: '83',
        },
        containers: [],
        fields_to_containers: [],
        flow_logic: [
          { LINE: 'PROCESS BEFORE OUTPUT.' },
          { LINE: `* MODULE STATUS_${args.screen_number}.` },
          { LINE: '' },
          { LINE: 'PROCESS AFTER INPUT.' },
          { LINE: `* MODULE USER_COMMAND_${args.screen_number}.` },
        ],
      });

    await callDispatch(connection, 'DYNPRO_INSERT', {
      program: programName,
      dynpro: args.screen_number,
      dynpro_data: screenData,
    });

    logger?.info(`Screen created: ${programName}/${args.screen_number}`);

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
    }

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number: args.screen_number,
          type: 'DYNP',
          activated: shouldActivate,
          message: shouldActivate
            ? `Screen ${programName}/${args.screen_number} created and activated.`
            : `Screen ${programName}/${args.screen_number} created (not activated).`,
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
    logger?.error(`Error creating screen: ${errorMessage}`);
    return return_error(new Error(`Failed to create screen: ${errorMessage}`));
  }
}
