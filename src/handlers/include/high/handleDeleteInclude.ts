/**
 * DeleteInclude Handler - Delete ABAP Include Program (Type I)
 *
 * Uses direct ADT REST API since AdtClient doesn't have include methods.
 * ADT endpoint: DELETE /sap/bc/adt/programs/includes/{name}
 *
 * Optionally removes the `INCLUDE <name>.` statement from the main program
 * source BEFORE deletion (to avoid SAP rejecting the delete because the
 * include is still referenced).
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
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
  name: 'DeleteInclude',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Delete an existing ABAP Include program (Type I) from the SAP system via ADT API. If the include is referenced by a main program, provide main_program so the handler can first remove the `INCLUDE <name>.` line from the main program source before deleting.',
  inputSchema: {
    type: 'object',
    properties: {
      include_name: {
        type: 'string',
        description: 'Include program name to delete.',
      },
      main_program: {
        type: 'string',
        description:
          'Optional. Name of the main program referencing this include. If provided, the `INCLUDE <name>.` line is removed from the main program source first (so the include is no longer referenced and delete succeeds).',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number. Required for transportable packages. Optional for local ($TMP) objects. Also used for updating the main program if main_program is provided.',
      },
      remove_from_main: {
        type: 'boolean',
        description:
          'Auto-remove `INCLUDE <name>.` line from main program source. Default: true when main_program is provided. Set false to skip the main-program modification.',
      },
    },
    required: ['include_name'],
  },
} as const;

interface DeleteIncludeArgs {
  include_name: string;
  main_program?: string;
  transport_request?: string;
  remove_from_main?: boolean;
}

/**
 * Remove `INCLUDE <name>.` lines from source code (case-insensitive).
 * Returns the new source and whether any line was removed.
 */
function removeIncludeStatement(
  mainSource: string,
  includeName: string,
): { newSource: string; removed: boolean } {
  const lowerInclude = includeName.toLowerCase();
  const usesCrlf = mainSource.includes('\r\n');
  const newline = usesCrlf ? '\r\n' : '\n';
  const lines = mainSource.split(/\r?\n/);

  // Match lines like:  INCLUDE zname.    " comment
  // Not matching if the line is itself a comment (*, ")
  const includeLineRegex = new RegExp(
    `^\\s*INCLUDE\\s+${lowerInclude}\\s*\\.`,
    'i',
  );

  const filteredLines: string[] = [];
  let removed = false;
  for (const line of lines) {
    const trimmed = line.trimStart();
    const isComment = trimmed.startsWith('*') || trimmed.startsWith('"');
    if (!isComment && includeLineRegex.test(line)) {
      removed = true;
      continue; // skip this line
    }
    filteredLines.push(line);
  }

  return { newSource: filteredLines.join(newline), removed };
}

/**
 * Extract SAP error message from an axios error response body
 */
function extractSapError(error: any): string | undefined {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const errorData = error?.response?.data
      ? parser.parse(error.response.data)
      : null;
    const errorMsg =
      errorData?.['exc:exception']?.message?.['#text'] ||
      errorData?.['exc:exception']?.message;
    return errorMsg ? `SAP Error: ${errorMsg}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read main program source, remove INCLUDE statement, write back and activate.
 * Returns a human-readable note.
 */
async function removeFromMainProgram(
  connection: IAbapConnection,
  mainProgram: string,
  includeName: string,
  transportRequest: string | undefined,
  logger: HandlerContext['logger'],
  stepsCompleted: string[],
): Promise<string> {
  const encodedMain = encodeSapObjectName(mainProgram);
  const programBaseUrl = `/sap/bc/adt/programs/programs/${encodedMain}`;
  const sourceUrl = `${programBaseUrl}/source/main`;

  // 1. Read current source
  logger?.debug(`Reading main program source: ${mainProgram}`);
  const readResponse = await makeAdtRequestWithTimeout(
    connection,
    sourceUrl,
    'GET',
    'default',
  );
  const currentSource =
    typeof readResponse.data === 'string'
      ? readResponse.data
      : String(readResponse.data ?? '');

  if (!currentSource) {
    throw new Error('Main program source is empty or unreadable');
  }

  const { newSource, removed } = removeIncludeStatement(
    currentSource,
    includeName,
  );

  if (!removed) {
    const note = `INCLUDE ${includeName} line not found in ${mainProgram} — skipping main program update.`;
    logger?.info(note);
    stepsCompleted.push('skip_remove_not_present');
    return note;
  }

  // 2. Lock main program (stateful)
  logger?.debug(`Locking main program: ${mainProgram}`);
  connection.setSessionType('stateful');
  const lockResponse = await makeAdtRequestWithTimeout(
    connection,
    `${programBaseUrl}?_action=LOCK&accessMode=MODIFY`,
    'POST',
    'default',
    null,
    undefined,
    { Accept: ACCEPT_LOCK },
  );
  connection.setSessionType('stateless');

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
      `Failed to obtain lock handle for main program ${mainProgram}`,
    );
  }

  try {
    // 3. PUT new source
    let updateUrl = `${sourceUrl}?lockHandle=${encodeURIComponent(String(lockHandle))}`;
    if (transportRequest) {
      updateUrl += `&corrNr=${transportRequest}`;
    }
    await makeAdtRequestWithTimeout(
      connection,
      updateUrl,
      'PUT',
      'default',
      newSource,
      undefined,
      { 'Content-Type': 'text/plain; charset=utf-8' },
    );
    stepsCompleted.push('remove_from_main');
    logger?.info(`Removed INCLUDE ${includeName}. line from ${mainProgram}`);
  } finally {
    // 4. Unlock (stateful)
    try {
      connection.setSessionType('stateful');
      await makeAdtRequestWithTimeout(
        connection,
        `${programBaseUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(String(lockHandle))}`,
        'POST',
        'default',
        null,
      );
      connection.setSessionType('stateless');
    } catch (unlockErr) {
      connection.setSessionType('stateless');
      logger?.warn(
        `Failed to unlock main program ${mainProgram}: ${unlockErr instanceof Error ? unlockErr.message : String(unlockErr)}`,
      );
    }
  }

  // 5. Activate main program — this releases the include reference
  try {
    const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${programBaseUrl}" adtcore:name="${mainProgram}"/></adtcore:objectReferences>`;
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
    stepsCompleted.push('activate_main');
    logger?.info(`Main program ${mainProgram} activated`);
  } catch (activateErr) {
    logger?.warn(
      `Main program activation warning: ${activateErr instanceof Error ? activateErr.message : String(activateErr)}`,
    );
  }

  return `INCLUDE ${includeName}. removed from ${mainProgram}.`;
}

export async function handleDeleteInclude(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: DeleteIncludeArgs = params;

  if (!args.include_name) {
    return return_error(new Error('include_name is required'));
  }

  if (isCloudConnection()) {
    return return_error(
      new Error(
        'Include programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
      ),
    );
  }

  const includeName = args.include_name.toUpperCase();
  const mainProgram = args.main_program?.toUpperCase();
  const encodedName = encodeSapObjectName(includeName);
  const baseUrl = `/sap/bc/adt/programs/includes/${encodedName}`;
  const shouldRemoveFromMain = !!mainProgram && args.remove_from_main !== false;

  logger?.info(`Starting include deletion: ${includeName}`);

  const stepsCompleted: string[] = [];
  let removeNote: string | undefined;
  let lockHandle: string | undefined;

  try {
    // ---- Step 0: Remove from main program (if requested) ----
    if (shouldRemoveFromMain && mainProgram) {
      try {
        removeNote = await removeFromMainProgram(
          connection,
          mainProgram,
          includeName,
          args.transport_request,
          logger,
          stepsCompleted,
        );
      } catch (removeErr: any) {
        const sapErrorMsg = extractSapError(removeErr);
        removeNote = `Could not remove reference from ${mainProgram}: ${sapErrorMsg || (removeErr instanceof Error ? removeErr.message : String(removeErr))}`;
        logger?.warn(removeNote);
        // Continue — delete will likely still fail with "referenced" error,
        // but the SAP message is more helpful than our soft failure.
      }
    }

    // ---- Step 1: Lock include (stateful) ----
    logger?.debug(`Locking include for deletion: ${includeName}`);
    connection.setSessionType('stateful');
    const lockResponse = await makeAdtRequestWithTimeout(
      connection,
      `${baseUrl}?_action=LOCK&accessMode=MODIFY`,
      'POST',
      'default',
      null,
      undefined,
      { Accept: ACCEPT_LOCK },
    );
    connection.setSessionType('stateless');

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
        `Failed to obtain lock handle for include ${includeName}`,
      );
    }
    stepsCompleted.push('lock');

    // ---- Step 2: DELETE with lockHandle + optional corrNr ----
    const deleteParams: Record<string, string> = {
      lockHandle: String(lockHandle),
    };
    if (args.transport_request) {
      deleteParams.corrNr = args.transport_request;
    }

    await makeAdtRequestWithTimeout(
      connection,
      baseUrl,
      'DELETE',
      'default',
      undefined,
      deleteParams,
    );
    lockHandle = undefined;
    stepsCompleted.push('delete');

    logger?.info(`✅ DeleteInclude completed: ${includeName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          include_name: includeName,
          main_program: mainProgram || null,
          transport_request: args.transport_request || null,
          message: removeNote
            ? `Include ${includeName} deleted. ${removeNote}`
            : `Include ${includeName} deleted successfully.`,
          steps_completed: stepsCompleted,
          remove_note: removeNote || null,
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
    // Attempt unlock if still locked after failure
    if (lockHandle) {
      try {
        connection.setSessionType('stateful');
        await makeAdtRequestWithTimeout(
          connection,
          `${baseUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(String(lockHandle))}`,
          'POST',
          'default',
          null,
        );
        connection.setSessionType('stateless');
        logger?.debug(`Include unlocked after error: ${includeName}`);
      } catch (unlockErr) {
        connection.setSessionType('stateless');
        logger?.warn(
          `Failed to unlock include after error: ${unlockErr instanceof Error ? unlockErr.message : String(unlockErr)}`,
        );
      }
    }

    let errorMessage = error instanceof Error ? error.message : String(error);

    const sapErrorMsg = extractSapError(error);
    if (sapErrorMsg) {
      errorMessage = sapErrorMsg;
    }

    // Add status-specific hints if not already a SAP error
    if (!errorMessage.startsWith('SAP Error:')) {
      if (error.response?.status === 404) {
        errorMessage = `Include ${includeName} not found. It may already be deleted.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Include ${includeName} is locked by another user. Cannot delete.`;
      } else if (error.response?.status === 400) {
        errorMessage = `Bad request (400). Check if transport request is required and valid.`;
      }
    }

    logger?.error(`Error deleting include ${includeName}: ${errorMessage}`);
    return return_error(
      new Error(`Failed to delete include ${includeName}: ${errorMessage}`),
    );
  }
}
