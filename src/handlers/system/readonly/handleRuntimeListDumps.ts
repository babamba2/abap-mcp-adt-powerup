import { AdtRuntimeClient } from '@babamba2/mcp-abap-adt-clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { return_error, return_response } from '../../../lib/utils';
import { parseRuntimePayloadToJson } from './runtimePayloadParser';

export const TOOL_DEFINITION = {
  name: 'RuntimeListDumps',
  available_in: ['onprem', 'cloud'] as const,
  description:
    "[runtime] List ABAP runtime dumps with optional user filter and paging. Returns parsed JSON payload. Each entry's HTML summary (~13 KB per dump) is omitted unless include_summary=true — use RuntimeGetDumpById / RuntimeAnalyzeDump for one dump's details.",
  inputSchema: {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description:
          'Optional username filter. If omitted, dumps for all users are returned.',
      },
      inlinecount: {
        type: 'string',
        enum: ['allpages', 'none'],
        description: 'Include total count metadata.',
      },
      top: {
        type: 'number',
        description: 'Maximum number of records to return.',
      },
      skip: {
        type: 'number',
        description: 'Number of records to skip.',
      },
      orderby: {
        type: 'string',
        description: 'ADT order by expression.',
      },
      include_summary: {
        type: 'boolean',
        description:
          "Keep each entry's HTML summary (atom:summary). Default false — it is ~96% of the payload and duplicates what RuntimeGetDumpById returns.",
      },
    },
    required: [],
  },
} as const;

interface RuntimeListDumpsArgs {
  user?: string;
  inlinecount?: 'allpages' | 'none';
  top?: number;
  skip?: number;
  orderby?: string;
  include_summary?: boolean;
}

/**
 * Drop `atom:summary` from every feed entry, leaving the feed's shape intact.
 *
 * The summary is a full HTML rendering of the dump (tables, source excerpt,
 * call stack) — about 12.7 KB of a 13.3 KB entry. A 20-dump list came back at
 * 250 KB, most of which an agent never reads from a list: it picks an entry by
 * error name / program / user / time and then asks for that one dump. Ids,
 * categories, titles, timestamps and links all stay.
 */
export function stripDumpSummaries(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const feed = (payload as Record<string, unknown>)['atom:feed'];
  if (!feed || typeof feed !== 'object') return payload;
  const entries = (feed as Record<string, unknown>)['atom:entry'];
  const strip = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return entry;
    const { 'atom:summary': _omitted, ...rest } = entry as Record<
      string,
      unknown
    >;
    return rest;
  };
  return {
    ...(payload as Record<string, unknown>),
    'atom:feed': {
      ...feed,
      'atom:entry': Array.isArray(entries)
        ? entries.map(strip)
        : strip(entries),
    },
  };
}

export async function handleRuntimeListDumps(
  context: HandlerContext,
  args: RuntimeListDumpsArgs,
) {
  const { connection, logger } = context;

  try {
    const runtimeClient = new AdtRuntimeClient(connection, logger);
    const { user, inlinecount, top, skip, orderby, include_summary } =
      args || {};

    const response = user
      ? await runtimeClient.listRuntimeDumpsByUser(user, {
          inlinecount,
          top,
          skip,
          orderby,
        })
      : await runtimeClient.listRuntimeDumps({
          inlinecount,
          top,
          skip,
          orderby,
        });

    const parsed = parseRuntimePayloadToJson(response.data);
    return return_response({
      data: JSON.stringify(
        {
          success: true,
          user_filter: user || null,
          status: response.status,
          payload: include_summary ? parsed : stripDumpSummaries(parsed),
        },
        null,
        2,
      ),
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config,
    });
  } catch (error: any) {
    logger?.error('Error listing runtime dumps:', error);
    return return_error(error);
  }
}
