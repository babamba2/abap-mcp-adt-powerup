/**
 * ListTransports Handler - List user's transport requests via ADT API
 *
 * Retrieves transport requests for the current user or specified user.
 * Uses AdtClient.getRequest().list() with proper Accept negotiation.
 */

import { XMLParser } from 'fast-xml-parser';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { getSystemContext } from '../../../lib/systemContext';
import { return_error } from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ListTransports',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[read-only] List transport requests for the current or specified user. Returns modifiable and/or released workbench and customizing requests.',
  inputSchema: {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description:
          'SAP user name. If not provided, returns transports for the current user.',
      },
      modifiable_only: {
        type: 'boolean',
        description:
          'Only return modifiable (not yet released) transports. Default: true.',
      },
    },
    required: [],
  },
} as const;

interface ListTransportsArgs {
  user?: string;
  modifiable_only?: boolean;
}

interface TransportEntry {
  number: string;
  description?: string;
  type?: string;
  status?: string;
  owner?: string;
  target?: string;
}

// ADT /sap/bc/adt/cts/transportrequests response structure:
//   tm:root
//     tm:workbench  (category, for workbench requests)
//       tm:modifiable  (status group)
//         tm:request[]  (one per TR)
//       tm:released
//         tm:request[]
//     tm:customizing
//       tm:modifiable / tm:released → tm:request[]
//
// The previous implementation only looked at root['tm:workbench']['tm:request'], missing
// the tm:modifiable / tm:released middle layer, so it silently returned 0 transports.
function collectRequests(
  root: Record<string, unknown> | undefined | null,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (!root) return out;
  for (const catKey of ['tm:workbench', 'tm:customizing']) {
    const category = root[catKey] as Record<string, unknown> | undefined;
    if (!category) continue;
    for (const statusKey of ['tm:modifiable', 'tm:released']) {
      const group = category[statusKey] as Record<string, unknown> | undefined;
      if (!group) continue;
      const reqs = group['tm:request'] as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined;
      if (!reqs) continue;
      const arr = Array.isArray(reqs) ? reqs : [reqs];
      out.push(...arr);
    }
  }
  // Back-compat fallback: flat structures (rare)
  if (out.length === 0 && root['tm:request']) {
    const direct = root['tm:request'] as
      | Record<string, unknown>
      | Record<string, unknown>[];
    const arr = Array.isArray(direct) ? direct : [direct];
    out.push(...arr);
  }
  return out;
}

function parseTransportListXml(xmlData: string): TransportEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => {
      return ['tm:request', 'tm:task'].includes(name);
    },
  });

  const result = parser.parse(xmlData);
  const root = result['tm:root'] || result['tm:roots'] || result;
  const requestList = collectRequests(root);

  return requestList
    .filter((req: Record<string, unknown>) => req)
    .map((req: Record<string, unknown>) => ({
      number:
        (req['tm:number'] as string) || (req['adtcore:name'] as string) || '',
      description:
        (req['tm:desc'] as string) || (req['tm:description'] as string) || '',
      type: (req['tm:type'] as string) || '',
      status: (req['tm:status'] as string) || '',
      owner: (req['tm:owner'] as string) || '',
      target: (req['tm:target'] as string) || '',
    }))
    .filter((t: TransportEntry) => t.number);
}

export async function handleListTransports(
  context: HandlerContext,
  args: ListTransportsArgs,
) {
  const { connection, logger } = context;
  try {
    const modifiableOnly = args?.modifiable_only !== false;
    const user =
      args?.user ||
      getSystemContext().responsible ||
      process.env.SAP_USERNAME ||
      '';

    logger?.debug(
      `ListTransports: user=${user}, modifiable_only=${modifiableOnly}`,
    );

    const client = createAdtClient(connection, logger);
    const state = await client.getRequest().list({
      user,
      status: modifiableOnly ? 'D' : undefined,
    });

    const transports = parseTransportListXml(state.listResult?.data || '');

    logger?.info(`ListTransports: found ${transports.length} transport(s)`);

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: transports.length,
              transports,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    return return_error(error);
  }
}
