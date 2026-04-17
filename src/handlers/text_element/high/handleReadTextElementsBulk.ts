/**
 * ReadTextElementsBulk — return every text element of a program in ONE call.
 *
 * Matches WriteTextElementsBulk semantics: we read the whole TPOOL via the
 * `ZMCP_ADT_TEXTPOOL` RFC (single SAP round-trip) and partition the rows
 * by ID (R / I / S / H). The native /textelements subsource endpoints
 * exist but only surface the editor-view of I/S/H and don't expose R at
 * all, so using TPOOL RFC directly keeps this tool aligned with the
 * WriteTextElementsBulk storage path and exposes every type uniformly.
 *
 * Existing single-row GetTextElement stays row-by-row for callers that
 * want one entry.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callTextpool } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ReadTextElementsBulk',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Read every text element (R/I/S/H) of a program in ONE call via the TPOOL RFC. Partitions rows by type and returns structured arrays. Use this instead of calling GetTextElement per row.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: { type: 'string', description: 'Program name.' },
      language: {
        type: 'string',
        description: '1-char language. Defaults to SAP logon language.',
      },
    },
    required: ['program_name'],
  },
} as const;

interface ReadBulkArgs {
  program_name: string;
  language?: string;
}

interface Entry {
  type: 'R' | 'I' | 'S' | 'H';
  key: string;
  text: string;
  length: number;
}

export async function handleReadTextElementsBulk(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: ReadBulkArgs = params;

  if (!args?.program_name) {
    return return_error(new Error('program_name is required'));
  }
  if (isCloudConnection()) {
    return return_error(
      new Error('Text elements are not available on ABAP Cloud'),
    );
  }

  const programName = args.program_name.toUpperCase();
  const language = (args.language || '').toUpperCase();

  logger?.info(`ReadTextElementsBulk: ${programName}`);

  try {
    const { result: fetched } = await callTextpool(connection, 'READ', {
      program: programName,
      language,
    });
    const raw: any[] = Array.isArray(fetched) ? fetched : [];

    const bucket: Record<'R' | 'I' | 'S' | 'H', Entry[]> = {
      R: [],
      I: [],
      S: [],
      H: [],
    };
    let rEntry: { text: string; length: number } | null = null;

    for (const r of raw) {
      const id = String(r?.ID ?? r?.id ?? '').toUpperCase();
      const key = String(r?.KEY ?? r?.key ?? '');
      const text = String(r?.ENTRY ?? r?.entry ?? '');
      const length = Number(r?.LENGTH ?? r?.length ?? 0);
      if (id !== 'R' && id !== 'I' && id !== 'S' && id !== 'H') continue;
      bucket[id].push({ type: id, key, text, length });
      if (id === 'R') rEntry = { text, length };
    }

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          language: language || null,
          counts: {
            R: bucket.R.length,
            I: bucket.I.length,
            S: bucket.S.length,
            H: bucket.H.length,
            total: raw.length,
          },
          r: rEntry,
          symbols: bucket.I.map((e) => ({ key: e.key, text: e.text })),
          selections: bucket.S.map((e) => ({
            key: e.key.trim(),
            text: e.text,
          })),
          headings: bucket.H.map((e) => ({ key: e.key, text: e.text })),
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
    logger?.error(`ReadTextElementsBulk failed: ${errorMessage}`);
    return return_error(
      new Error(`ReadTextElementsBulk failed: ${errorMessage}`),
    );
  }
}
