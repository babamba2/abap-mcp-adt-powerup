/**
 * Integration test for PatchGuiStatus.
 *
 * Scenario:
 *   1) Create a throwaway ABAP program.
 *   2) Seed full CUA via UpdateGuiStatus (2 statuses, 3 functions, 3 PFK
 *      rows, 3 BUT rows, 2 TIT rows).
 *   3) Call PatchGuiStatus with a MINIMAL change (just one FUN ICON_ID
 *      and one TIT TEXT) and verify:
 *        - the unchanged rows and fields are preserved verbatim
 *        - the changed fields actually changed
 *   4) Verify UpdateGuiStatus still rejects obviously-broken input (row
 *      with missing required field) unless skip_validation=true.
 */

import { handlePatchGuiStatus } from '../../../../handlers/gui_status/high/handlePatchGuiStatus';
import { handleUpdateGuiStatus } from '../../../../handlers/gui_status/high/handleUpdateGuiStatus';
import { handleReadGuiStatus } from '../../../../handlers/gui_status/readonly/handleReadGuiStatus';
import { handleCreateProgram } from '../../../../handlers/program/high/handleCreateProgram';
import { handleDeleteProgram } from '../../../../handlers/program/high/handleDeleteProgram';
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

const fullCua = {
  ADM: { ACTCODE: '000001', MENCODE: '000001', PFKCODE: '000001' },
  STA: [
    {
      CODE: 'S0100',
      MODAL: 'N',
      ACTCODE: '000001',
      PFKCODE: '000001',
      BUTCODE: '0001',
      INT_NOTE: 'List',
    },
    {
      CODE: 'S0200',
      MODAL: 'N',
      ACTCODE: '000001',
      PFKCODE: '000001',
      BUTCODE: '0001',
      INT_NOTE: 'Detail',
    },
  ],
  FUN: [
    {
      CODE: 'BACK',
      TEXTNO: '001',
      TEXT_TYPE: 'S',
      FUN_TEXT: 'Back',
      PATH: 'B',
    },
    {
      CODE: 'EXIT',
      TEXTNO: '001',
      TEXT_TYPE: 'S',
      FUN_TEXT: 'Exit',
      PATH: 'X',
    },
    {
      CODE: 'CANC',
      TEXTNO: '001',
      TEXT_TYPE: 'S',
      TEXT_NAME: 'ICON_CANCEL',
      ICON_ID: '@0W@',
      FUN_TEXT: 'Cancel',
      PATH: 'A',
    },
  ],
  PFK: [
    { CODE: '000001', PFNO: '03', FUNCODE: 'BACK' },
    { CODE: '000001', PFNO: '12', FUNCODE: 'CANC' },
    { CODE: '000001', PFNO: '15', FUNCODE: 'EXIT' },
  ],
  BUT: [
    { PFK_CODE: '000001', CODE: '0001', NO: '01', PFNO: '03' },
    { PFK_CODE: '000001', CODE: '0001', NO: '02', PFNO: '15' },
    { PFK_CODE: '000001', CODE: '0001', NO: '03', PFNO: '12' },
  ],
  TIT: [
    { CODE: 'T01', TEXT: 'Original title 01' },
    { CODE: 'T02', TEXT: 'Original title 02' },
  ],
  MEN: [],
  MTX: [],
  ACT: [],
  SET: [],
  DOC: [],
  BIV: [],
};

describe('PatchGuiStatus — row-level merge', () => {
  let tester: LambdaTester;
  const logger = createTestLogger('patch-gui');

  beforeAll(async () => {
    tester = new LambdaTester(
      'gui_status_patch_handlers',
      'test_patch_gui_status',
      'patch-gui',
    );
    await tester.beforeAll(
      async (_context: LambdaTesterContext) => {
        logger?.info('PatchGuiStatus suite setup');
      },
      async () => {},
    );
  }, getTimeout('long'));

  afterAll(async () => {
    await tester.afterAll(async () => {});
  });

  it(
    'preserves unchanged rows and fields while applying the change',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        if (context.isCloudSystem) throw new Error('SKIP: onprem only');
        if (!context.packageName)
          throw new Error('SKIP: no package configured');

        const stamp = suffix();
        const programName = `ZMCP_PGS${stamp}`.slice(0, 30).toUpperCase();
        const ctx = createHandlerContext({
          connection: context.connection,
          logger,
        });

        let createdProgram = false;
        try {
          const cp = await handleCreateProgram(ctx, {
            program_name: programName,
            package_name: context.packageName,
            transport_request: context.transportRequest,
            description: 'patch gui test',
            program_type: 'executable',
          });
          if (cp.isError) throw new Error(`CreateProgram: ${errorText(cp)}`);
          createdProgram = true;

          // 1) Seed full CUA.
          const seed = await handleUpdateGuiStatus(ctx, {
            program_name: programName,
            cua_data: fullCua,
            activate: true,
          });
          if (seed.isError)
            throw new Error(`seed UpdateGuiStatus: ${errorText(seed)}`);

          // 2) Snapshot seeded state for comparison.
          const readA = await handleReadGuiStatus(ctx, {
            program_name: programName,
          });
          if (readA.isError)
            throw new Error(`read after seed: ${errorText(readA)}`);
          const defA = parseText(readA).definition;
          expect(defA.FUN).toHaveLength(3);
          expect(defA.BUT).toHaveLength(3);
          expect(defA.PFK).toHaveLength(3);

          // 3) Patch: only change BACK's ICON_ID and T01's TEXT.
          const patchResp = await handlePatchGuiStatus(ctx, {
            program_name: programName,
            changes: {
              FUN: [{ CODE: 'BACK', ICON_ID: '@03@' }],
              TIT: [{ CODE: 'T01', TEXT: 'patched title 01' }],
            },
            activate: true,
          });
          if (patchResp.isError)
            throw new Error(`PatchGuiStatus: ${errorText(patchResp)}`);
          const patchBody = parseText(patchResp);
          expect(patchBody.success).toBe(true);
          // Merge should keep the original row counts (no rows were added).
          expect(patchBody.summary).toMatchObject({
            sta: 2,
            fun: 3,
            pfk: 3,
            but: 3,
            tit: 2,
          });

          // 4) Read again — verify everything is still there, BACK has new ICON_ID,
          //    BACK retains FUN_TEXT / PATH, T01 has new text, T02 untouched.
          const readB = await handleReadGuiStatus(ctx, {
            program_name: programName,
          });
          if (readB.isError)
            throw new Error(`read after patch: ${errorText(readB)}`);
          const defB = parseText(readB).definition;

          expect(defB.STA).toHaveLength(2);
          expect(defB.FUN).toHaveLength(3);
          expect(defB.PFK).toHaveLength(3);
          expect(defB.BUT).toHaveLength(3);
          expect(defB.TIT).toHaveLength(2);

          const backB = defB.FUN.find((f: any) => f.CODE === 'BACK');
          expect(backB).toBeDefined();
          expect(backB.ICON_ID).toBe('@03@'); // changed
          expect(backB.FUN_TEXT).toBe('Back'); // preserved
          expect(backB.PATH).toBe('B'); // preserved

          const exitB = defB.FUN.find((f: any) => f.CODE === 'EXIT');
          expect(exitB).toMatchObject({
            CODE: 'EXIT',
            FUN_TEXT: 'Exit',
            PATH: 'X',
          });

          const cancB = defB.FUN.find((f: any) => f.CODE === 'CANC');
          expect(cancB).toMatchObject({
            CODE: 'CANC',
            FUN_TEXT: 'Cancel',
            ICON_ID: '@0W@',
          });

          const tit01 = defB.TIT.find((t: any) => t.CODE === 'T01');
          expect(tit01.TEXT).toBe('patched title 01');
          const tit02 = defB.TIT.find((t: any) => t.CODE === 'T02');
          expect(tit02.TEXT).toBe('Original title 02');
        } finally {
          if (createdProgram) {
            try {
              await handleDeleteProgram(ctx, {
                program_name: programName,
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

  it(
    'UpdateGuiStatus rejects obviously-broken cua_data unless skip_validation=true',
    async () => {
      await tester.run(async (context: LambdaTesterContext) => {
        if (context.isCloudSystem) throw new Error('SKIP: onprem only');
        const ctx = createHandlerContext({
          connection: context.connection,
          logger,
        });
        // No SAP round-trip needed — validation should fail first.
        const badUpdate = await handleUpdateGuiStatus(ctx, {
          program_name: 'ZMCP_DOES_NOT_MATTER',
          cua_data: { STA: [{ CODE: '' }], PFK: [{ CODE: '000001' }] },
        });
        expect(badUpdate.isError).toBe(true);
        const text = errorText(badUpdate);
        expect(text).toMatch(/validation problem/i);
        expect(text).toMatch(/STA\[0\]/);
        expect(text).toMatch(/PFK\[0\]/);
      });
    },
    getTimeout('default'),
  );
});
