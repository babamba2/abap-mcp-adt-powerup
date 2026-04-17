/**
 * Integration test — mass activation of a main program + cyclic includes.
 *
 * Scenario:
 *   1 CreateProgram(main, activate=false — SAP auto-creates `REPORT` shell)
 *   N CreateInclude(source_code=inline body, insert_into_main=true,
 *                   activate_main_program=false, skip_program_tree_check=true)
 *   1 ActivateObjects({main + N includes})
 *
 * The includes cross-reference each other (TYPES defined in inc1 used by
 * inc2, etc.), so any per-include activation attempt would fail because
 * its siblings are still inactive. The assertion below is that ActivateObjects
 * resolves the whole set in one go.
 *
 * Parameterized N ∈ {2, 5, 8} to verify scaling within the 2–8 range
 * we expect in production.
 */

import { handleActivateObjects } from '../../../../handlers/common/high/handleActivateObjects';
import { handleCreateInclude } from '../../../../handlers/include/high/handleCreateInclude';
import { handleDeleteInclude } from '../../../../handlers/include/high/handleDeleteInclude';
import { handleCreateProgram } from '../../../../handlers/program/high/handleCreateProgram';
import { handleDeleteProgram } from '../../../../handlers/program/high/handleDeleteProgram';
import { getTimeout } from '../../helpers/configHelpers';
import { createTestLogger } from '../../helpers/loggerHelpers';
import { LambdaTester } from '../../helpers/testers/LambdaTester';
import type { LambdaTesterContext } from '../../helpers/testers/types';
import { createHandlerContext } from '../../helpers/testHelpers';

function parseTextPayload(result: any): any {
  const text = result?.content?.find((c: any) => c.type === 'text')?.text;
  if (!text) throw new Error('Missing text payload in handler response');
  return JSON.parse(text);
}

function extractHandlerErrorText(result: any): string {
  const text = result?.content?.find((c: any) => c.type === 'text')?.text;
  return typeof text === 'string' && text.trim()
    ? text
    : JSON.stringify(result);
}

function suffix(): string {
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${Date.now().toString(36).slice(-4).toUpperCase()}${rand}`;
}

/**
 * Source bodies for N cross-referencing includes. Dependency graph:
 *   inc1  TYPES ty_line
 *   inc2  TYPES ty_table OF ty_line    (needs inc1)
 *   inc3  FORM process USING ty_table  (needs inc2)
 *   inc4  DATA gt TYPE ty_table        (needs inc2)
 *   inc5  START-OF-SELECTION + PERFORM process  (needs inc3)
 *   inc6  CONSTANTS c_prefix TYPE ty_line
 *   inc7  TYPES ty_many TYPE STANDARD TABLE OF ty_line
 *   inc8  FORM finalize. DATA lv TYPE ty_line. ENDFORM.
 */
function buildIncludeSource(i: number): string {
  switch (i) {
    case 1:
      return `TYPES ty_line TYPE c LENGTH 40.\n`;
    case 2:
      return `TYPES ty_table TYPE STANDARD TABLE OF ty_line WITH EMPTY KEY.\n`;
    case 3:
      return `FORM process USING p_tbl TYPE ty_table.
  DATA lv TYPE ty_line.
  LOOP AT p_tbl INTO lv.
    WRITE / lv.
  ENDLOOP.
ENDFORM.\n`;
    case 4:
      return `DATA gt_data TYPE ty_table.\n`;
    case 5:
      return `START-OF-SELECTION.
  APPEND 'first' TO gt_data.
  APPEND 'second' TO gt_data.
  PERFORM process USING gt_data.\n`;
    case 6:
      return `CONSTANTS c_prefix TYPE ty_line VALUE 'MCP'.\n`;
    case 7:
      return `TYPES ty_many TYPE STANDARD TABLE OF ty_line WITH EMPTY KEY.\n`;
    case 8:
      return `FORM finalize.
  DATA lv_final TYPE ty_line VALUE 'done'.
  WRITE / lv_final.
ENDFORM.\n`;
    default:
      return `* placeholder for include ${i}\n`;
  }
}

describe('Mass activation — main + cyclic includes', () => {
  let tester: LambdaTester;
  const logger = createTestLogger('mass-activation');

  beforeAll(async () => {
    tester = new LambdaTester(
      'mass_activation_handlers',
      'test_mass_activation',
      'mass-activation',
    );
    // Test params: no setup required; `runtime_readonly_handlers` test_case
    // in test-config.yaml doesn't cover this, so we fall back to environment
    // defaults. LambdaTester.beforeAll tolerates a missing test_case block.
    await tester.beforeAll(
      async (_context: LambdaTesterContext) => {
        logger?.info('Mass activation suite setup');
      },
      async (_context: LambdaTesterContext) => {
        logger?.info('No generic cleanup — per-test afterEach cleans up');
      },
    );
  }, getTimeout('long'));

  afterAll(async () => {
    await tester.afterAll(async (_context: LambdaTesterContext) => {
      logger?.info('Mass activation suite done');
    });
  });

  it.each([2, 5, 8])(
    'activates main + %i cross-referencing includes in a single ActivateObjects call',
    async (n) => {
      await tester.run(async (context: LambdaTesterContext) => {
        if (context.isCloudSystem) {
          throw new Error('SKIP: includes are on-prem only');
        }
        if (!context.packageName) {
          throw new Error('SKIP: package is not configured');
        }

        const stamp = suffix();
        const mainName = `ZMCP_MASS${stamp}`.slice(0, 30).toUpperCase();
        const includeNames = Array.from({ length: n }, (_, i) =>
          `ZMCP_MI${stamp}${String(i + 1).padStart(2, '0')}`
            .slice(0, 30)
            .toUpperCase(),
        );

        const handlerContext = createHandlerContext({
          connection: context.connection,
          logger,
        });

        const created: { main: boolean; includes: string[] } = {
          main: false,
          includes: [],
        };

        try {
          // 1) Create main program (shell). SAP produces a minimal REPORT stub.
          const createProg = await handleCreateProgram(handlerContext, {
            program_name: mainName,
            package_name: context.packageName,
            transport_request: context.transportRequest,
            description: `MCP mass-activation main ${stamp}`.slice(0, 60),
            program_type: 'executable',
          });
          if (createProg.isError) {
            throw new Error(
              `CreateProgram failed: ${extractHandlerErrorText(createProg)}`,
            );
          }
          created.main = true;

          // 2..n+1) Create N includes — each with inline source and deferred
          // activation. insert_into_main=true appends INCLUDE statements to
          // the main REPORT in creation order, which matches the dependency
          // chain.
          for (let i = 0; i < n; i += 1) {
            const incName = includeNames[i];
            const createInc = await handleCreateInclude(handlerContext, {
              include_name: incName,
              main_program: mainName,
              package_name: context.packageName,
              transport_request: context.transportRequest,
              description: `MCP mass inc ${i + 1} ${stamp}`.slice(0, 60),
              source_code: buildIncludeSource(i + 1),
              insert_into_main: true,
              activate_main_program: false,
              skip_program_tree_check: true,
            });
            if (createInc.isError) {
              throw new Error(
                `CreateInclude ${incName} failed: ${extractHandlerErrorText(createInc)}`,
              );
            }
            const incBody = parseTextPayload(createInc);
            expect(incBody.source_written).toBe(true);
            expect(incBody.activated).toBe(false);
            created.includes.push(incName);
          }

          // n+2) Single mass activation — the whole set in one call.
          const activate = await handleActivateObjects(handlerContext, {
            objects: [
              { name: mainName, type: 'PROG/P' },
              ...includeNames.map((nm) => ({ name: nm, type: 'PROG/I' })),
            ],
            preaudit: true,
          });
          if (activate.isError) {
            throw new Error(
              `ActivateObjects failed: ${extractHandlerErrorText(activate)}`,
            );
          }
          const actBody = parseTextPayload(activate);
          expect(actBody.success).toBe(true);
          expect(actBody.activated).toBe(true);
          expect(actBody.errors).toEqual([]);
          expect(actBody.objects).toHaveLength(n + 1);
          for (const obj of actBody.objects) {
            expect(obj.status).toBe('activated');
          }
        } finally {
          // Cleanup — deletions are best-effort. Includes first, then main.
          for (const incName of created.includes) {
            try {
              await handleDeleteInclude(handlerContext, {
                include_name: incName,
                main_program: mainName,
                transport_request: context.transportRequest,
              });
            } catch (err: any) {
              logger?.warn(
                `Cleanup failed for include ${incName}: ${err?.message || err}`,
              );
            }
          }
          if (created.main) {
            try {
              await handleDeleteProgram(handlerContext, {
                program_name: mainName,
                transport_request: context.transportRequest,
              });
            } catch (err: any) {
              logger?.warn(
                `Cleanup failed for main program ${mainName}: ${err?.message || err}`,
              );
            }
          }
        }
      });
    },
    getTimeout('long'),
  );
});
