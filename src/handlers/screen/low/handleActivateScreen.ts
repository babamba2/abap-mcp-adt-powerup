/**
 * ActivateScreen Handler - Activate parent program (includes screens)
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
  name: 'ActivateScreenLow',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[low-level] Activate an ABAP program to make Screen changes active.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
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

interface ActivateScreenArgs {
  program_name: string;
  session_id?: string;
  session_state?: {
    cookies?: string;
    csrf_token?: string;
    cookie_store?: Record<string, string>;
  };
}

export async function handleActivateScreen(
  context: HandlerContext,
  args: ActivateScreenArgs,
) {
  const { connection, logger } = context;
  try {
    const { program_name, session_id, session_state } = args;
    if (!program_name) {
      return return_error(new Error('program_name is required'));
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
    const encodedProgram = encodeSapObjectName(programName);
    const programUri = `/sap/bc/adt/programs/programs/${encodedProgram}`;

    logger?.info(`Activating program for screen: ${programName}`);

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

    logger?.info(`✅ Program activated: ${programName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          session_id: session_id || null,
          message: `Program ${programName} activated successfully.`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Error activating program: ${errorMessage}`);
    return return_error(new Error(`Failed to activate: ${errorMessage}`));
  }
}
