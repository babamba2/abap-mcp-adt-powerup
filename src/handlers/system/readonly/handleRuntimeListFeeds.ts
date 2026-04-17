import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  makeAdtRequestWithTimeout,
  return_error,
  return_response,
} from '../../../lib/utils';
import {
  FEED_URLS,
  fetchFeed,
  type IFeedQueryOptions,
  parseFeedDescriptors,
  parseFeedVariants,
  parseGatewayErrors,
  parseRuntimeDumpFeed,
  parseSystemMessages,
} from './runtimeFeedsHelper';

const ATOM_FEED_HEADERS = { Accept: 'application/atom+xml;type=feed' };

export const TOOL_DEFINITION = {
  name: 'RuntimeListFeeds',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[runtime] List available ADT runtime feeds or read a specific feed type. Feed types: dumps, system_messages, gateway_errors. Without feed_type returns available feed descriptors.',
  inputSchema: {
    type: 'object',
    properties: {
      feed_type: {
        type: 'string',
        enum: [
          'descriptors',
          'variants',
          'dumps',
          'system_messages',
          'gateway_errors',
        ],
        description:
          'Feed to read. "descriptors" lists available feeds, "variants" lists feed variants, others read that specific feed. Default: descriptors.',
        default: 'descriptors',
      },
      user: {
        type: 'string',
        description: 'Filter feed entries by SAP username.',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of entries to return.',
      },
      from: {
        type: 'string',
        description: 'Start of time range in YYYYMMDDHHMMSS format.',
      },
      to: {
        type: 'string',
        description: 'End of time range in YYYYMMDDHHMMSS format.',
      },
    },
    required: [],
  },
} as const;

interface RuntimeListFeedsArgs {
  feed_type?:
    | 'descriptors'
    | 'variants'
    | 'dumps'
    | 'system_messages'
    | 'gateway_errors';
  user?: string;
  max_results?: number;
  from?: string;
  to?: string;
}

export async function handleRuntimeListFeeds(
  context: HandlerContext,
  args: RuntimeListFeedsArgs,
) {
  const { connection, logger } = context;

  try {
    const feedType = args?.feed_type ?? 'descriptors';
    const queryOptions: IFeedQueryOptions = {
      user: args?.user,
      maxResults: args?.max_results,
      from: args?.from,
      to: args?.to,
    };

    let data: unknown;
    let response: any;

    switch (feedType) {
      case 'descriptors': {
        response = await makeAdtRequestWithTimeout(
          connection,
          '/sap/bc/adt/feeds',
          'GET',
          'default',
          undefined,
          undefined,
          ATOM_FEED_HEADERS,
        );
        data = parseFeedDescriptors(response.data);
        break;
      }
      case 'variants': {
        response = await makeAdtRequestWithTimeout(
          connection,
          '/sap/bc/adt/feeds/variants',
          'GET',
          'default',
          undefined,
          undefined,
          ATOM_FEED_HEADERS,
        );
        data = parseFeedVariants(response.data);
        break;
      }
      case 'dumps': {
        response = await fetchFeed(
          connection,
          FEED_URLS.dumps,
          queryOptions,
          'user',
        );
        data = parseRuntimeDumpFeed(response.data);
        break;
      }
      case 'system_messages': {
        response = await fetchFeed(
          connection,
          FEED_URLS.systemMessages,
          queryOptions,
          'user',
        );
        data = parseSystemMessages(response.data);
        break;
      }
      case 'gateway_errors': {
        response = await fetchFeed(
          connection,
          FEED_URLS.gatewayErrors,
          queryOptions,
          'username',
        );
        data = parseGatewayErrors(response.data);
        break;
      }
    }

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          feed_type: feedType,
          count: Array.isArray(data) ? data.length : undefined,
          entries: data,
        },
        null,
        2,
      ),
      status: response?.status ?? 200,
      statusText: response?.statusText ?? 'OK',
      headers: response?.headers ?? {},
      config: response?.config ?? {},
    });
  } catch (error: unknown) {
    logger?.error('Error reading feeds:', error);
    return return_error(error);
  }
}
