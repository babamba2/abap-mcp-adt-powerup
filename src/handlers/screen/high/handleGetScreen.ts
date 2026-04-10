/**
 * GetScreen Handler - Get ABAP Screen (Dynpro) with metadata and flow logic
 *
 * Uses ZMCP_ADT_DISPATCH RFC via SOAP to call RPY_DYNPRO_READ.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/soapRfc';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetScreen',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Get ABAP Screen (Dynpro) definition including metadata, fields, and flow logic source code.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name (e.g., SAPMV45A).',
      },
      screen_number: {
        type: 'string',
        description: 'Screen number (e.g., 0100).',
      },
    },
    required: ['program_name', 'screen_number'],
  },
} as const;

export async function handleGetScreen(context: HandlerContext, params: any) {
  const { connection, logger } = context;
  const args = params as { program_name: string; screen_number: string };

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
  logger?.info(`Getting screen: ${programName} / ${args.screen_number}`);

  try {
    const { result } = await callDispatch(connection, 'DYNPRO_READ', {
      program: programName,
      dynpro: args.screen_number,
    });

    // /ui2/cl_json=>serialize default keeps ABAP field names UPPERCASE.
    const flowLogicArr = result?.FLOW_LOGIC ?? result?.flow_logic;
    let flowLogic: string | null = null;
    if (Array.isArray(flowLogicArr)) {
      flowLogic = flowLogicArr
        .map((line: any) => line.LINE ?? line.line ?? '')
        .join('\n');
    }

    logger?.info(
      `✅ GetScreen completed: ${programName}/${args.screen_number}`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          screen_number: args.screen_number,
          type: 'DYNP',
          flow_logic: flowLogic,
          metadata: result?.HEADER ?? result?.header ?? null,
          containers: result?.CONTAINERS ?? result?.containers ?? [],
          fields_to_containers:
            result?.FIELDS_TO_CONTAINERS ?? result?.fields_to_containers ?? [],
          steps_completed: ['get_metadata', 'get_flow_logic'],
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
    logger?.error(`Error getting screen: ${errorMessage}`);
    return return_error(new Error(`Failed to get screen: ${errorMessage}`));
  }
}
