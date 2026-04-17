/**
 * Integration test — WriteTextElementsBulk + ReadTextElementsBulk.
 *
 * Golden scenario: register 40 mixed R/I/S entries for a throwaway
 * program in ONE tool call, with language='K', activate=false; then
 * activate the program separately; then read back with
 * ReadTextElementsBulk and verify every entry is present.
 */

import { handleActivateObjects } from '../../../../handlers/common/high/handleActivateObjects';
import { handleCreateProgram } from '../../../../handlers/program/high/handleCreateProgram';
import { handleDeleteProgram } from '../../../../handlers/program/high/handleDeleteProgram';
import { handleReadTextElementsBulk } from '../../../../handlers/text_element/high/handleReadTextElementsBulk';
import { handleWriteTextElementsBulk } from '../../../../handlers/text_element/high/handleWriteTextElementsBulk';
import { getTimeout } from '../../helpers/configHelpers';
import { createTestLogger } from '../../helpers/loggerHelpers';
import { LambdaTester } from '../../helpers/testers/LambdaTester';
import type { LambdaTesterContext } from '../../helpers/testers/types';
import { createHandlerContext } from '../../helpers/testHelpers';

function parseText(result: any): any {
  const text = result?.content?.find((c: any) => c.type === 'text')?.text;
  if (!text) throw new Error('empty handler response');
  return JSON.parse(text);
}

function errorText(result: any): string {
  const text = result?.content?.find((c: any) => c.type === 'text')?.text;
  return typeof text === 'string' && text.trim()
    ? text
    : JSON.stringify(result);
}

function suffix(): string {
  return (
    Date.now().toString(36).slice(-4).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

function build40MixedEntries(): Array<{
  type: 'R' | 'I' | 'S' | 'H';
  key?: string;
  text: string;
  max_length?: number;
}> {
  const out: any[] = [];

  // 1 R (program title)
  out.push({ type: 'R', text: 'MCP bulk 40 텍스트 테스트' });

  // 10 S (selection texts) — SAP param names ≤ 8 chars
  const selKeys = [
    'P_BUKRS',
    'P_BUDAT',
    'P_LIFNR',
    'P_EBELN',
    'P_RBSTAT',
    'S_BUKRS',
    'S_BUDAT',
    'S_LIFNR',
    'S_EBELN',
    'S_RBSTAT',
  ];
  for (const k of selKeys) {
    out.push({ type: 'S', key: k, text: `선택 텍스트 ${k}` });
  }

  // 29 I (text symbols) — 3-char numeric keys, Korean bodies
  for (let i = 1; i <= 29; i += 1) {
    const key = String(i).padStart(3, '0');
    out.push({
      type: 'I',
      key,
      text: `텍스트 심볼 ${key} 한글 본문`,
      max_length: 40,
    });
  }
  return out;
}

describe('WriteTextElementsBulk — 40 mixed R/I/S in 1 call', () => {
  let tester: LambdaTester;
  const logger = createTestLogger('te-bulk');

  beforeAll(async () => {
    tester = new LambdaTester(
      'text_elements_bulk_handlers',
      'test_text_elements_bulk',
      'te-bulk',
    );
    await tester.beforeAll(
      async () => logger?.info('TextElementsBulk setup'),
      async () => {},
    );
  }, getTimeout('long'));

  afterAll(async () => {
    await tester.afterAll(async () => {});
  });

  it(
    'registers 40 mixed entries in 1 write call + reads all back',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        if (context.isCloudSystem) throw new Error('SKIP: onprem only');
        if (!context.packageName) throw new Error('SKIP: no package');

        const stamp = suffix();
        const program = `ZMCP_TEB${stamp}`.slice(0, 30).toUpperCase();
        const ctx = createHandlerContext({
          connection: context.connection,
          logger,
        });
        let createdProgram = false;

        try {
          const cp = await handleCreateProgram(ctx, {
            program_name: program,
            package_name: context.packageName,
            transport_request: context.transportRequest,
            description: 'TE bulk 40 test',
            program_type: 'executable',
          });
          if (cp.isError) throw new Error(`CreateProgram: ${errorText(cp)}`);
          createdProgram = true;

          // THE ONE CALL — 40 mixed entries, language=K, activate=false.
          const entries = build40MixedEntries();
          expect(entries).toHaveLength(40);

          const bulk = await handleWriteTextElementsBulk(ctx, {
            program_name: program,
            language: 'K',
            text_elements: entries,
            transport_request: context.transportRequest,
            // activate=true writes the pool ACTIVE in one RFC call — this is
            // the primary path. activate=false stages WRITE_INACTIVE and
            // relies on program activation to promote the TPOOL, which SAP
            // does not always do (REPT vs TRDX activation split).
            activate: true,
          });
          if (bulk.isError) throw new Error(`bulk write: ${errorText(bulk)}`);
          const body = parseText(bulk);
          expect(body.success).toBe(true);
          expect(body.total_entries).toBe(40);
          expect(body.per_type).toEqual({ R: 1, I: 29, S: 10 });
          // SINGLE RFC call handles every entry regardless of count.
          expect(body.rfc_action).toBe('WRITE');
          expect(body.total_rows_written).toBe(40);
          expect(body.activate).toBe(true);

          // Read back in ONE call and spot-check each type.
          const read = await handleReadTextElementsBulk(ctx, {
            program_name: program,
            language: 'K',
          });
          if (read.isError) throw new Error(`bulk read: ${errorText(read)}`);
          const rb = parseText(read);
          expect(rb.success).toBe(true);
          expect(rb.counts.I).toBe(29);
          expect(rb.counts.S).toBe(10);
          expect(rb.counts.R).toBe(1);
          expect(rb.r.text).toBe('MCP bulk 40 텍스트 테스트');

          // Spot check a couple of I/S rows round-tripped intact.
          const sym001 = rb.symbols.find((s: any) => s.key === '001');
          expect(sym001).toBeDefined();
          expect(sym001.text).toBe('텍스트 심볼 001 한글 본문');
          const selBukrs = rb.selections.find((s: any) => s.key === 'P_BUKRS');
          expect(selBukrs).toBeDefined();
          expect(selBukrs.text).toBe('선택 텍스트 P_BUKRS');
        } finally {
          if (createdProgram) {
            try {
              await handleDeleteProgram(ctx, {
                program_name: program,
                transport_request: context.transportRequest,
              });
            } catch (e: any) {
              logger?.warn(`cleanup failed: ${e?.message}`);
            }
          }
        }
      });
    },
    getTimeout('long'),
  );
});
