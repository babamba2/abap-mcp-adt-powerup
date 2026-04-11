/**
 * GetTextElement Handler (High-level) - Read ABAP program text pool
 *
 * Uses ZMCP_ADT_TEXTPOOL RFC via SOAP (READ action).
 * Text pool rows are text symbols ('I'), selection texts ('S'),
 * report title ('R') and list headings ('H'). Optionally filters
 * by text_type and key.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callTextpool } from '../../../lib/soapRfc';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetTextElement',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Read ABAP program text pool (text symbols, selection texts, title, headings). Optionally filter by text_type / key.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Program name (e.g., Z_MY_PROGRAM).',
      },
      language: {
        type: 'string',
        description:
          'Language key (1-char, e.g., "E", "D", "K"). Defaults to the SAP logon language.',
      },
      text_type: {
        type: 'string',
        description:
          'Filter by ID: "I"=text symbol, "S"=selection text, "R"=program title, "H"=list heading.',
        enum: ['I', 'S', 'R', 'H'],
      },
      key: {
        type: 'string',
        description:
          'Optional: filter by row key (e.g., "001" for text symbol TEXT-001, or a parameter name for selection text).',
      },
    },
    required: ['program_name'],
  },
} as const;

interface GetTextElementArgs {
  program_name: string;
  language?: string;
  text_type?: 'I' | 'S' | 'R' | 'H';
  key?: string;
}

export async function handleGetTextElement(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: GetTextElementArgs = params;

  if (!args.program_name) {
    return return_error(new Error('Missing required parameter: program_name'));
  }

  if (isCloudConnection()) {
    return return_error(
      new Error(
        'Text elements are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
      ),
    );
  }

  const programName = args.program_name.toUpperCase();
  const language = (args.language || '').toUpperCase();
  const textType = args.text_type?.toUpperCase();
  const filterKey = args.key?.trim().toUpperCase();

  logger?.info(
    `Getting text elements: ${programName}${language ? ` [${language}]` : ''}`,
  );

  try {
    const { result } = await callTextpool(connection, 'READ', {
      program: programName,
      language,
    });

    // /ui2/cl_json=>serialize keeps ABAP field names UPPERCASE.
    let rows: any[] = Array.isArray(result) ? result : [];

    if (textType) {
      rows = rows.filter(
        (r) => String(r?.ID ?? r?.id ?? '').toUpperCase() === textType,
      );
    }
    if (filterKey) {
      rows = rows.filter(
        (r) =>
          String(r?.KEY ?? r?.key ?? '')
            .trim()
            .toUpperCase() === filterKey,
      );
    }

    logger?.info(
      `✅ GetTextElement completed: ${programName} (${rows.length} rows)`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          language: language || null,
          text_type: textType || null,
          key: filterKey || null,
          total_rows: rows.length,
          text_elements: rows,
          steps_completed: ['get_text_pool'],
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
    logger?.error(`Error reading text elements: ${errorMessage}`);
    return return_error(
      new Error(`Failed to read text elements: ${errorMessage}`),
    );
  }
}
