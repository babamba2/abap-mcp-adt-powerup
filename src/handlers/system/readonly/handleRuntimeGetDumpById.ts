import { AdtRuntimeClient } from '@babamba2/mcp-abap-adt-clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { return_error, return_response } from '../../../lib/utils';
import {
  compactFormattedDump,
  extractDumpFacts,
  extractFormattedHeaderFacts,
} from './runtimeDumpFormat';
import { parseRuntimePayloadToJson } from './runtimePayloadParser';

export const TOOL_DEFINITION = {
  name: 'RuntimeGetDumpById',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[runtime] Read a specific ABAP runtime dump by dump ID. Default view (~7 KB): dump metadata, termination link (object + line) and chapter index. Use response_mode="summary" for key facts only (runtime error, exception, program, termination object/line, user, date). For the ST22 long text pass chapters=["developer"] (or chapter titles) to get only those chapters, compacted (~10 KB instead of ~50 KB).',
  inputSchema: {
    type: 'object',
    properties: {
      dump_id: {
        type: 'string',
        description:
          'Runtime dump ID (for example: 694AB694097211F1929806D06D234D38).',
      },
      view: {
        type: 'string',
        enum: ['default', 'summary', 'formatted'],
        description:
          'Dump view mode: default payload, summary section, or formatted long text.',
        default: 'default',
      },
      response_mode: {
        type: 'string',
        enum: ['payload', 'summary', 'both'],
        description:
          'Controls what is returned: "payload" (default, legacy) — full parsed dump data only, "summary" — compact key facts only (title, exception, program, line, user, date...), "both" — summary + full payload.',
        default: 'payload',
      },
      chapters: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Formatted long text only (implies view="formatted"): keep just these chapters, without box borders or padding. "developer" = Short Text, What happened?, Error analysis, Chain of Exception Objects, Information on where terminated, Source Code Extract, Active Calls/Events, User and Transaction. Other entries match chapter titles by prefix, e.g. "Selected Variables".',
      },
    },
    required: ['dump_id'],
  },
} as const;

interface RuntimeGetDumpByIdArgs {
  dump_id: string;
  view?: 'default' | 'summary' | 'formatted';
  response_mode?: 'payload' | 'summary' | 'both';
  chapters?: string[];
}

function collectKeyFacts(
  value: unknown,
  target: Record<string, unknown>,
  depth: number = 0,
): void {
  if (!value || depth > 8 || Object.keys(target).length >= 20) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeyFacts(item, target, depth + 1);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const interestingKeys = [
    'title',
    'shorttext',
    'shortText',
    'category',
    'exception',
    'program',
    'include',
    'line',
    'user',
    'date',
    'time',
    'host',
    'application',
    'component',
    'client',
  ];

  const obj = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(obj)) {
    const keyNormalized = key.toLowerCase();
    const isInteresting = interestingKeys.some(
      (candidate) => keyNormalized === candidate.toLowerCase(),
    );

    if (
      isInteresting &&
      target[key] === undefined &&
      (typeof nested === 'string' ||
        typeof nested === 'number' ||
        typeof nested === 'boolean')
    ) {
      target[key] = nested;
    }

    collectKeyFacts(nested, target, depth + 1);
  }
}

export async function handleRuntimeGetDumpById(
  context: HandlerContext,
  args: RuntimeGetDumpByIdArgs,
) {
  const { connection, logger } = context;

  try {
    if (!args?.dump_id) {
      throw new Error('Parameter "dump_id" is required');
    }

    const chapters = Array.isArray(args.chapters)
      ? args.chapters.filter((c) => typeof c === 'string' && c.trim() !== '')
      : [];
    const view = chapters.length ? 'formatted' : (args.view ?? 'default');
    const responseMode = args.response_mode ?? 'payload';
    const runtimeClient = new AdtRuntimeClient(connection, logger);
    const response = await runtimeClient.getRuntimeDumpById(args.dump_id, {
      view,
    });
    let parsedPayload: unknown = parseRuntimePayloadToJson(response.data);

    let summary: Record<string, unknown> | undefined;
    if (responseMode === 'summary' || responseMode === 'both') {
      summary = { ...extractDumpFacts(parsedPayload) };
      if (!Object.keys(summary).length) {
        summary = { ...extractFormattedHeaderFacts(parsedPayload) };
      }
      if (!Object.keys(summary).length) {
        collectKeyFacts(parsedPayload, summary);
      }
    }

    if (chapters.length && typeof parsedPayload === 'string') {
      parsedPayload = compactFormattedDump(parsedPayload, chapters);
    }

    const body: Record<string, unknown> = {
      success: true,
      dump_id: args.dump_id,
      view,
      response_mode: responseMode,
      status: response.status,
    };
    if (summary !== undefined) {
      body.summary = summary;
    }
    if (responseMode !== 'summary') {
      body.payload = parsedPayload;
    }

    return return_response({
      data: JSON.stringify(body, null, 2),
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config,
    });
  } catch (error: any) {
    logger?.error('Error reading runtime dump by ID:', error);
    return return_error(error);
  }
}
