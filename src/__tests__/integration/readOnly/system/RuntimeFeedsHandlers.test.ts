/**
 * Integration tests for runtime feeds handlers.
 *
 * Covers:
 *   - RuntimeListFeeds (descriptors / variants / dumps / system_messages / gateway_errors)
 *   - RuntimeListSystemMessages (SM02)
 *   - RuntimeGetGatewayErrorLog (/IWFND/ERROR_LOG, list + optional detail)
 *   - RuntimeGetDumpById response_mode extension (payload/summary/both)
 *
 * All tests hit a real SAP system via tests/test-config.yaml.
 */

import { handleRuntimeGetDumpById } from '../../../../handlers/system/readonly/handleRuntimeGetDumpById';
import { handleRuntimeGetGatewayErrorLog } from '../../../../handlers/system/readonly/handleRuntimeGetGatewayErrorLog';
import { handleRuntimeListDumps } from '../../../../handlers/system/readonly/handleRuntimeListDumps';
import { handleRuntimeListFeeds } from '../../../../handlers/system/readonly/handleRuntimeListFeeds';
import { handleRuntimeListSystemMessages } from '../../../../handlers/system/readonly/handleRuntimeListSystemMessages';
import { getTimeout } from '../../helpers/configHelpers';
import { createTestLogger } from '../../helpers/loggerHelpers';
import { LambdaTester } from '../../helpers/testers/LambdaTester';
import type { LambdaTesterContext } from '../../helpers/testers/types';
import { createHandlerContext } from '../../helpers/testHelpers';

function parseTextPayload(result: any): any {
  const textContent = result.content.find((c: any) => c.type === 'text') as any;
  if (!textContent?.text) {
    throw new Error('Missing text payload in handler response');
  }
  return JSON.parse(textContent.text);
}

function extractHandlerErrorText(result: any): string {
  try {
    const textContent = result?.content?.find((c: any) => c.type === 'text');
    if (typeof textContent?.text === 'string' && textContent.text.trim()) {
      return textContent.text;
    }
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function extractDumpIdsFromPayload(payload: unknown): string[] {
  const ids = new Set<string>();
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const regex = /\/sap\/bc\/adt\/runtime\/dump(?:s)?\/([^"'?&<\s]+)/g;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    ids.add(match[1]);
    match = regex.exec(raw);
  }
  return [...ids];
}

describe('Runtime Feeds Handlers Integration', () => {
  let tester: LambdaTester;
  const logger = createTestLogger('runtime-feeds');

  beforeAll(async () => {
    tester = new LambdaTester(
      'runtime_readonly_handlers',
      'test_runtime_readonly',
      'runtime-feeds',
    );
    await tester.beforeAll(
      async (_context: LambdaTesterContext) => {
        logger?.info('Runtime feeds handlers setup complete');
      },
      async (_context: LambdaTesterContext) => {
        logger?.info('No cleanup required for readonly runtime handlers');
      },
    );
  }, getTimeout('long'));

  afterAll(async () => {
    await tester.afterAll(async (_context: LambdaTesterContext) => {
      logger?.info('Runtime feeds handlers test suite complete');
    });
  });

  it(
    'RuntimeListFeeds descriptors — returns feed catalog',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        const invoke = async (
          toolName: string,
          args: Record<string, unknown>,
          directCall: () => Promise<any>,
        ) => tester.invokeToolOrHandler(toolName, args, directCall);

        const result = await invoke(
          'RuntimeListFeeds',
          { feed_type: 'descriptors' },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeListFeeds(handlerContext, {
              feed_type: 'descriptors',
            });
          },
        );
        if (result.isError) {
          throw new Error(
            `RuntimeListFeeds descriptors failed: ${extractHandlerErrorText(result)}`,
          );
        }
        const data = parseTextPayload(result);
        expect(data.success).toBe(true);
        expect(data.feed_type).toBe('descriptors');
        expect(Array.isArray(data.entries)).toBe(true);
        // Expect at least the dumps feed descriptor to be present on any S/4 system.
        const dumpsDescriptor = (data.entries as any[]).find(
          (e) => typeof e?.url === 'string' && e.url.includes('/runtime/dumps'),
        );
        expect(dumpsDescriptor).toBeDefined();
      });
    },
    getTimeout('default'),
  );

  it(
    'RuntimeListFeeds dumps — returns dump feed entries',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        const invoke = async (
          toolName: string,
          args: Record<string, unknown>,
          directCall: () => Promise<any>,
        ) => tester.invokeToolOrHandler(toolName, args, directCall);

        const result = await invoke(
          'RuntimeListFeeds',
          { feed_type: 'dumps', max_results: 10 },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeListFeeds(handlerContext, {
              feed_type: 'dumps',
              max_results: 10,
            });
          },
        );
        if (result.isError) {
          throw new Error(
            `RuntimeListFeeds dumps failed: ${extractHandlerErrorText(result)}`,
          );
        }
        const data = parseTextPayload(result);
        expect(data.success).toBe(true);
        expect(data.feed_type).toBe('dumps');
        expect(Array.isArray(data.entries)).toBe(true);
        // No strict count assertion — the system may genuinely have 0 dumps.
      });
    },
    getTimeout('long'),
  );

  it(
    'RuntimeListSystemMessages — list SM02 messages',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        const invoke = async (
          toolName: string,
          args: Record<string, unknown>,
          directCall: () => Promise<any>,
        ) => tester.invokeToolOrHandler(toolName, args, directCall);

        const result = await invoke(
          'RuntimeListSystemMessages',
          { max_results: 10 },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeListSystemMessages(handlerContext, {
              max_results: 10,
            });
          },
        );
        if (result.isError) {
          throw new Error(
            `RuntimeListSystemMessages failed: ${extractHandlerErrorText(result)}`,
          );
        }
        const data = parseTextPayload(result);
        expect(data.success).toBe(true);
        expect(typeof data.count).toBe('number');
        expect(Array.isArray(data.messages)).toBe(true);
        // Each returned message should carry the documented shape
        for (const msg of data.messages as any[]) {
          expect(typeof msg.id).toBe('string');
          expect(typeof msg.title).toBe('string');
        }
      });
    },
    getTimeout('default'),
  );

  it(
    'RuntimeGetGatewayErrorLog list mode — on-prem only',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        if (context.isCloudSystem) {
          throw new Error('SKIP: gateway error log is an on-prem ABAP feature');
        }

        const invoke = async (
          toolName: string,
          args: Record<string, unknown>,
          directCall: () => Promise<any>,
        ) => tester.invokeToolOrHandler(toolName, args, directCall);

        const result = await invoke(
          'RuntimeGetGatewayErrorLog',
          { max_results: 5 },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeGetGatewayErrorLog(handlerContext, {
              max_results: 5,
            });
          },
        );
        if (result.isError) {
          // Gateway error log can be unavailable (auth, service not active).
          // Don't fail the suite — log and skip.
          const errText = extractHandlerErrorText(result);
          logger?.warn(
            `RuntimeGetGatewayErrorLog is not available on this system: ${errText}`,
          );
          return;
        }
        const data = parseTextPayload(result);
        expect(data.success).toBe(true);
        expect(data.mode).toBe('list');
        expect(Array.isArray(data.errors)).toBe(true);

        // If there's at least one entry with a link, fetch its detail.
        const firstWithLink = (data.errors as any[]).find(
          (e) => typeof e?.link === 'string' && e.link.length > 0,
        );
        if (firstWithLink) {
          const detailResult = await invoke(
            'RuntimeGetGatewayErrorLog',
            { error_url: firstWithLink.link },
            async () => {
              const handlerContext = createHandlerContext({
                connection: context.connection,
                logger,
              });
              return handleRuntimeGetGatewayErrorLog(handlerContext, {
                error_url: firstWithLink.link,
              });
            },
          );
          if (!detailResult.isError) {
            const detailData = parseTextPayload(detailResult);
            expect(detailData.success).toBe(true);
            expect(detailData.mode).toBe('detail');
            expect(detailData.error).toBeDefined();
          } else {
            logger?.warn(
              `Gateway error detail fetch failed: ${extractHandlerErrorText(detailResult)}`,
            );
          }
        }
      });
    },
    getTimeout('default'),
  );

  it(
    'RuntimeGetDumpById response_mode — payload/summary/both backward-compatible',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        const invoke = async (
          toolName: string,
          args: Record<string, unknown>,
          directCall: () => Promise<any>,
        ) => tester.invokeToolOrHandler(toolName, args, directCall);

        // Locate any existing dump on the system via RuntimeListDumps
        const listResult = await invoke(
          'RuntimeListDumps',
          { inlinecount: 'allpages', top: 20 },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeListDumps(handlerContext, {
              inlinecount: 'allpages',
              top: 20,
            });
          },
        );
        if (listResult.isError) {
          throw new Error(
            `RuntimeListDumps failed: ${extractHandlerErrorText(listResult)}`,
          );
        }
        const listData = parseTextPayload(listResult);
        const dumpIds = extractDumpIdsFromPayload(listData.payload);
        if (dumpIds.length === 0) {
          // Fall back: use RuntimeListFeeds dumps
          const feedsResult = await invoke(
            'RuntimeListFeeds',
            { feed_type: 'dumps', max_results: 20 },
            async () => {
              const handlerContext = createHandlerContext({
                connection: context.connection,
                logger,
              });
              return handleRuntimeListFeeds(handlerContext, {
                feed_type: 'dumps',
                max_results: 20,
              });
            },
          );
          if (!feedsResult.isError) {
            const feedsData = parseTextPayload(feedsResult);
            for (const entry of (feedsData.entries as any[]) ?? []) {
              const id = entry?.id;
              if (typeof id === 'string' && id.length >= 10) {
                dumpIds.push(id);
              }
            }
          }
        }
        if (dumpIds.length === 0) {
          logger?.warn(
            'SKIP: no runtime dumps available on this system to exercise response_mode',
          );
          return;
        }
        const dumpId = dumpIds[0];

        // Default (no response_mode) — must stay payload-only for back-compat
        const defaultResult = await invoke(
          'RuntimeGetDumpById',
          { dump_id: dumpId, view: 'default' },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeGetDumpById(handlerContext, {
              dump_id: dumpId,
              view: 'default',
            });
          },
        );
        if (defaultResult.isError) {
          throw new Error(
            `RuntimeGetDumpById default failed: ${extractHandlerErrorText(defaultResult)}`,
          );
        }
        const defaultData = parseTextPayload(defaultResult);
        expect(defaultData.success).toBe(true);
        expect(defaultData.dump_id).toBe(dumpId);
        expect(defaultData.response_mode).toBe('payload');
        expect(defaultData.payload).toBeDefined();
        expect(defaultData.summary).toBeUndefined();

        // summary — no payload returned
        const summaryResult = await invoke(
          'RuntimeGetDumpById',
          { dump_id: dumpId, view: 'default', response_mode: 'summary' },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeGetDumpById(handlerContext, {
              dump_id: dumpId,
              view: 'default',
              response_mode: 'summary',
            });
          },
        );
        if (summaryResult.isError) {
          throw new Error(
            `RuntimeGetDumpById summary failed: ${extractHandlerErrorText(summaryResult)}`,
          );
        }
        const summaryData = parseTextPayload(summaryResult);
        expect(summaryData.success).toBe(true);
        expect(summaryData.response_mode).toBe('summary');
        expect(summaryData.summary).toBeDefined();
        expect(summaryData.payload).toBeUndefined();

        // both — summary + payload
        const bothResult = await invoke(
          'RuntimeGetDumpById',
          { dump_id: dumpId, view: 'default', response_mode: 'both' },
          async () => {
            const handlerContext = createHandlerContext({
              connection: context.connection,
              logger,
            });
            return handleRuntimeGetDumpById(handlerContext, {
              dump_id: dumpId,
              view: 'default',
              response_mode: 'both',
            });
          },
        );
        if (bothResult.isError) {
          throw new Error(
            `RuntimeGetDumpById both failed: ${extractHandlerErrorText(bothResult)}`,
          );
        }
        const bothData = parseTextPayload(bothResult);
        expect(bothData.success).toBe(true);
        expect(bothData.response_mode).toBe('both');
        expect(bothData.summary).toBeDefined();
        expect(bothData.payload).toBeDefined();
      });
    },
    getTimeout('long'),
  );
});
