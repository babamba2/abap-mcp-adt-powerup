/**
 * UpdateTextElement Handler (High-level) - Modify an existing text element
 *
 * Lock program → READ text pool → replace matching row → WRITE back →
 * unlock → optional activate. Errors if the row does not exist.
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

const MAX_ENTRY_LEN = 132;

export const TOOL_DEFINITION = {
  name: 'UpdateTextElement',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Update an existing text element in an ABAP program text pool. Handles lock/unlock automatically.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Parent program name.' },
      text_type: {
        type: 'string',
        description: '"I"|"S"|"R"|"H" — see GetTextElement.',
        enum: ['I', 'S', 'R', 'H'],
      },
      key: {
        type: 'string',
        description: 'Row key. Required except for "R" (single program title).',
      },
      text: {
        type: 'string',
        description: `New text content (max ${MAX_ENTRY_LEN} characters).`,
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
    required: ['program_name', 'text_type', 'text'],
  },
} as const;

interface UpdateTextElementArgs {
  program_name: string;
  text_type: 'I' | 'S' | 'R' | 'H';
  key?: string;
  text: string;
  language?: string;
  transport_request?: string;
  activate?: boolean;
}

function keyMatches(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export async function handleUpdateTextElement(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: UpdateTextElementArgs = params;

  if (!args.program_name || !args.text_type || typeof args.text !== 'string') {
    return return_error(
      new Error('Missing required parameters: program_name, text_type, text'),
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
  const textType = args.text_type.toUpperCase() as 'I' | 'S' | 'R' | 'H';
  const language = (args.language || '').toUpperCase();
  const shouldActivate = args.activate === true;

  let rowKey = (args.key || '').trim().toUpperCase();
  if (textType === 'R') {
    rowKey = rowKey || programName;
  } else if (!rowKey) {
    return return_error(
      new Error(`key is required for text_type "${textType}"`),
    );
  }

  if (args.text.length > MAX_ENTRY_LEN) {
    return return_error(
      new Error(
        `text exceeds max length (${MAX_ENTRY_LEN} chars): got ${args.text.length}`,
      ),
    );
  }

  const encodedProgram = encodeSapObjectName(programName);
  const programUrl = `/sap/bc/adt/programs/programs/${encodedProgram}`;

  logger?.info(
    `Updating text element: ${programName} ${textType}/${rowKey}${language ? ` [${language}]` : ''}`,
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

    const idx = rows.findIndex(
      (r) => r.ID === textType && keyMatches(r.KEY, rowKey),
    );
    if (idx < 0) {
      throw new Error(
        `Text element not found: ${programName} ${textType}/${rowKey}. Use CreateTextElement to add it.`,
      );
    }

    rows[idx] = {
      ID: textType,
      KEY: rowKey,
      ENTRY: args.text,
      LENGTH: args.text.length,
    };

    await callTextpool(connection, 'WRITE', {
      program: programName,
      language,
      textpool_json: JSON.stringify(rows),
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
      `✅ Text element updated: ${programName} ${textType}/${rowKey}`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          text_type: textType,
          key: rowKey,
          text: args.text,
          length: args.text.length,
          language: language || null,
          activated: shouldActivate,
          message: shouldActivate
            ? `Text element ${programName} ${textType}/${rowKey} updated and activated.`
            : `Text element ${programName} ${textType}/${rowKey} updated (not activated).`,
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
    logger?.error(`Error updating text element: ${errorMessage}`);
    return return_error(
      new Error(`Failed to update text element: ${errorMessage}`),
    );
  }
}
