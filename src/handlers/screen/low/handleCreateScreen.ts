/**
 * CreateScreen Handler (Low-level) - Create a new ABAP Screen via RFC
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_INSERT.
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
  name: 'CreateScreenLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Create a new ABAP Screen (Dynpro) on an existing program.',
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
          'Full screen definition as JSON (header, containers, fields_to_containers, flow_logic). If omitted, creates a minimal empty screen.',
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
    required: ['program_name', 'screen_number'],
  },
} as const;

interface CreateScreenArgs {
  program_name: string;
  screen_number: string;
  description?: string;
  dynpro_data?: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleCreateScreen(
  context: HandlerContext,
  args: CreateScreenArgs,
) {
  const { connection, logger } = context;
  try {
    const {
      program_name,
      screen_number,
      description,
      dynpro_data,
      session_id,
      session_state,
    } = args;
    if (!program_name || !screen_number) {
      return return_error(
        new Error('program_name and screen_number are required'),
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
    logger?.info(`Creating screen: ${programName} / ${screen_number}`);

    // Build dynpro data - either from provided data or minimal defaults
    // /ui2/cl_json=>deserialize default requires UPPERCASE JSON keys to
    // map into ABAP structure fields (HEADER, CONTAINERS, ...).
    const screenData =
      dynpro_data ||
      JSON.stringify({
        HEADER: {
          PROGRAM: programName,
          SCREEN: screen_number,
          LANGUAGE: 'E',
          DESCRIPT: description || `Screen ${screen_number}`,
          TYPE: 'N',
          LINES: 20,
          COLUMNS: 83,
        },
        CONTAINERS: [],
        FIELDS_TO_CONTAINERS: [],
        FLOW_LOGIC: [
          { LINE: `PROCESS BEFORE OUTPUT.` },
          { LINE: `* MODULE STATUS_${screen_number}.` },
          { LINE: `` },
          { LINE: `PROCESS AFTER INPUT.` },
          { LINE: `* MODULE USER_COMMAND_${screen_number}.` },
        ],
      });

    await callDispatch(connection, 'DYNPRO_INSERT', {
      program: programName,
      dynpro: screen_number,
      dynpro_data: screenData,
    });

    logger?.info(`✅ Screen created: ${programName}/${screen_number}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number,
          session_id: session_id || null,
          message: `Screen ${programName}/${screen_number} created successfully.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error creating screen: ${errorMessage}`);
    return return_error(new Error(`Failed to create screen: ${errorMessage}`));
  }
}
