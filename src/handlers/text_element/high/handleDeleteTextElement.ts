/**
 * DeleteTextElement Handler (High-level) - Remove a text element row
 *
 * Lock → READ text pool → drop matching row(s) → WRITE back → unlock
 * → optional activate. Supports "*" to wipe a whole text_type (or the
 * entire text pool when text_type is also "*").
 */

import { XMLParser } from 'fast-xml-parser';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callTextpool } from '../../../lib/rfcBackend';
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
  name: 'DeleteTextElement',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Delete a text element from an ABAP program text pool. key="*" wipes all rows of the given text_type; text_type="*" wipes the whole pool.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      text_type: {
        type: 'string',
        description:
          '"I"|"S"|"R"|"H", or "*" to wipe every row in the language.',
        enum: ['I', 'S', 'R', 'H', '*'],
      },
      key: {
        type: 'string',
        description:
          'Row key, or "*" to delete every row of the given text_type.',
      },
      language: {
        type: 'string',
        description: 'Language key. Defaults to SAP logon language.',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number.',
      },
      activate: {
        type: 'boolean',
        description: 'Activate the parent program after write. Default: false.',
      },
    },
    required: ['program_name', 'text_type'],
  },
} as const;

interface DeleteTextElementArgs {
  program_name: string;
  text_type: 'I' | 'S' | 'R' | 'H' | '*';
  key?: string;
  language?: string;
  transport_request?: string;
  activate?: boolean;
}

function keyMatches(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export async function handleDeleteTextElement(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: DeleteTextElementArgs = params;

  if (!args.program_name || !args.text_type) {
    return return_error(
      new Error('Missing required parameters: program_name, text_type'),
    );
  }

  if (isCloudConnection()) {
    return return_error(
      new Error(
        'Text elements are not available on cloud systems (ABAP Cloud).',
      ),
    );
  }

  const programName = args.program_name.toUpperCase();
  const textType = args.text_type.toUpperCase();
  const language = (args.language || '').toUpperCase();
  const shouldActivate = args.activate === true;
  const wipeAll = textType === '*';
  let rowKey = (args.key || '').trim().toUpperCase();

  // For a targeted delete (not wildcard) we need a key, unless text_type
  // is "R" (single program title — key defaults to program name).
  if (!wipeAll && rowKey !== '*') {
    if (textType === 'R') {
      rowKey = rowKey || programName;
    } else if (!rowKey) {
      return return_error(
        new Error(
          `key is required for text_type "${textType}" (use "*" to delete all rows of this type)`,
        ),
      );
    }
  }

  const encodedProgram = encodeSapObjectName(programName);
  const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

  logger?.info(
    `Deleting text element: ${programName} ${textType}/${rowKey || '(wipe)'}${language ? ` [${language}]` : ''}`,
  );

  let lockHandle: string | undefined;

  try {
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

    const { result: fetched } = await callTextpool(connection, 'READ', {
      program: programName,
      language,
    });
    const rowsIn: any[] = Array.isArray(fetched) ? fetched : [];

    const rows = rowsIn.map((r) => ({
      ID: String(r?.ID ?? r?.id ?? '').toUpperCase(),
      KEY: String(r?.KEY ?? r?.key ?? ''),
      ENTRY: String(r?.ENTRY ?? r?.entry ?? ''),
      LENGTH: Number(r?.LENGTH ?? r?.length ?? 0),
    }));

    const beforeCount = rows.length;
    let kept: typeof rows;

    if (wipeAll) {
      kept = [];
    } else if (rowKey === '*') {
      kept = rows.filter((r) => r.ID !== textType);
    } else {
      kept = rows.filter(
        (r) => !(r.ID === textType && keyMatches(r.KEY, rowKey)),
      );
    }

    const removed = beforeCount - kept.length;
    if (removed === 0) {
      throw new Error(
        `Text element not found: ${programName} ${textType}/${rowKey || '(wipe)'}`,
      );
    }

    await callTextpool(connection, 'WRITE', {
      program: programName,
      language,
      textpool_json: JSON.stringify(kept),
    });

    await makeAdtRequestWithTimeout(
      connection,
      `${programUrl}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
      'POST',
      'default',
    );
    lockHandle = undefined;

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

    logger?.info(
      `✅ Text element deleted: ${programName} ${textType}/${rowKey || '(wipe)'} (${removed} rows removed)`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          text_type: textType,
          key: rowKey || null,
          language: language || null,
          rows_removed: removed,
          rows_remaining: kept.length,
          activated: shouldActivate,
          message: shouldActivate
            ? `Text element ${programName} ${textType}/${rowKey || '(wipe)'} deleted and activated.`
            : `Text element ${programName} ${textType}/${rowKey || '(wipe)'} deleted (not activated).`,
          steps_completed: [
            'lock',
            'read',
            'write',
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
    logger?.error(`Error deleting text element: ${errorMessage}`);
    return return_error(
      new Error(`Failed to delete text element: ${errorMessage}`),
    );
  }
}
