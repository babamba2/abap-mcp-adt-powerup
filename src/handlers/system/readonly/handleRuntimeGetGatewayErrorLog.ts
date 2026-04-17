import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  makeAdtRequestWithTimeout,
  return_error,
  return_response,
} from '../../../lib/utils';
import {
  FEED_URLS,
  fetchFeed,
  parseGatewayErrorDetail,
  parseGatewayErrors,
} from './runtimeFeedsHelper';

export const TOOL_DEFINITION = {
  name: 'RuntimeGetGatewayErrorLog',
  available_in: ['onprem'] as const,
  description:
    '[runtime] List SAP Gateway error log (/IWFND/ERROR_LOG) or get error detail. Returns structured entries with type, shortText, transactionId, dateTime, username. With error_url returns full detail including serviceInfo, errorContext, sourceCode, callStack.',
  inputSchema: {
    type: 'object',
    properties: {
      error_url: {
        type: 'string',
        description:
          'Feed URL of a specific error entry (from a previous list response link field). When provided, returns detailed error info instead of listing.',
      },
      user: {
        type: 'string',
        description: 'Filter errors by SAP username.',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of errors to return.',
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

interface RuntimeGetGatewayErrorLogArgs {
  error_url?: string;
  user?: string;
  max_results?: number;
  from?: string;
  to?: string;
}

export async function handleRuntimeGetGatewayErrorLog(
  context: HandlerContext,
  args: RuntimeGetGatewayErrorLogArgs,
) {
  const { connection, logger } = context;

  try {
    if (args?.error_url) {
      const detailResponse = await makeAdtRequestWithTimeout(
        connection,
        args.error_url,
        'GET',
        'default',
        undefined,
        undefined,
        { Accept: 'application/atom+xml;type=feed' },
      );
      const detail = parseGatewayErrorDetail(detailResponse.data);
      return return_response({
        data: JSON.stringify(
          {
            success: true,
            mode: 'detail',
            error: detail,
          },
          null,
          2,
        ),
        status: detailResponse.status,
        statusText: detailResponse.statusText,
        headers: detailResponse.headers,
        config: detailResponse.config,
      });
    }

    const listResponse = await fetchFeed(
      connection,
      FEED_URLS.gatewayErrors,
      {
        user: args?.user,
        maxResults: args?.max_results,
        from: args?.from,
        to: args?.to,
      },
      'username',
    );
    const errors = parseGatewayErrors(listResponse.data);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          mode: 'list',
          count: errors.length,
          errors,
        },
        null,
        2,
      ),
      status: listResponse.status,
      statusText: listResponse.statusText,
      headers: listResponse.headers,
      config: listResponse.config,
    });
  } catch (error: unknown) {
    logger?.error('Error reading gateway error log:', error);
    return return_error(error);
  }
}
