/**
 * WriteTextElementsBulk — register many text elements in a SINGLE call.
 *
 * Previously a 40-element load meant 40 separate tool invocations of
 * CreateTextElement, each doing its own LOCK / RFC READ / RFC WRITE /
 * UNLOCK cycle → 160+ round-trips and a read-then-write race when
 * parallelized. This handler folds every entry (R / I / S / H) into a
 * single `ZMCP_ADT_TEXTPOOL` RFC call.
 *
 * SAP's native pattern for TPOOL is a whole-pool INSERT (what SE38 → GoTo
 * → Text Elements does internally). We follow the same pattern:
 *
 *   activate=true  → RFC action 'WRITE'           (INSERT TEXTPOOL STATE 'A')
 *                    Pool is written active immediately.
 *   activate=false → RFC action 'WRITE_INACTIVE'  (INSERT TEXTPOOL STATE 'I')
 *                    Pool is staged inactive; the next activation of the
 *                    parent program promotes it atomically — every R / I /
 *                    S / H entry goes live together, matching the user's
 *                    "register 40 now, activate program later" flow.
 *
 * replace_existing=false re-reads the current pool first and merges the
 * caller's entries by (ID, KEY) so nothing outside the caller's set is
 * wiped.
 *
 * Existing CreateTextElement / UpdateTextElement tools remain untouched.
 */

import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callTextpool } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

const MAX_ENTRY_LEN = 132;

export const TOOL_DEFINITION = {
  name: 'WriteTextElementsBulk',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Register many ABAP text elements (R/I/S/H) in ONE tool call via a single TPOOL RFC write. Use instead of calling CreateTextElement N times. With activate=false (default) the pool is staged INACTIVE — the parent program\'s next activation promotes every entry atomically, which is the correct flow for "register 40 now, activate program later". With activate=true the pool is written ACTIVE immediately. Set replace_existing=false to merge into the current pool instead of replacing it.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Parent program name.',
      },
      language: {
        type: 'string',
        description:
          '1-char language key (e.g. "K" for Korean). Defaults to SAP logon language.',
      },
      text_elements: {
        type: 'array',
        minItems: 1,
        description:
          'Array of entries. Each: { type: "R"|"I"|"S"|"H", key?: string, text: string }. R ignores key (single-row program title — key defaults to program name). I requires a 3-char key. S requires a parameter / select-option name (max 8 chars). H requires one of "listHeader" or "columnHeader_N".',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['R', 'I', 'S', 'H'] },
            key: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['type', 'text'],
        },
      },
      replace_existing: {
        type: 'boolean',
        description:
          'If true (default), the TPOOL is replaced with the provided entries only. If false, existing rows are preserved and provided rows merge by (type, key).',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request number (informational).',
      },
      activate: {
        type: 'boolean',
        description:
          'false (default) — stage as INACTIVE (program activation promotes). true — write ACTIVE immediately.',
      },
    },
    required: ['program_name', 'text_elements'],
  },
} as const;

interface BulkEntry {
  type: 'R' | 'I' | 'S' | 'H';
  key?: string;
  text: string;
}

interface BulkArgs {
  program_name: string;
  language?: string;
  text_elements: BulkEntry[];
  replace_existing?: boolean;
  transport_request?: string;
  activate?: boolean;
}

interface TpoolRow {
  ID: string;
  KEY: string;
  ENTRY: string;
  LENGTH: number;
}

function rowKey(row: { ID: string; KEY: string }): string {
  return `${row.ID.toUpperCase()}::${row.KEY.trim().toUpperCase()}`;
}

function normalizeEntry(e: BulkEntry, programName: string): TpoolRow {
  const id = e.type.toUpperCase();
  let key: string;
  if (id === 'R') {
    // Single program-title row — ABAP stores KEY = programName (uppercased).
    key = (e.key?.trim() || programName).toUpperCase();
  } else {
    key = (e.key ?? '').trim();
  }
  return {
    ID: id,
    KEY: key,
    ENTRY: e.text ?? '',
    LENGTH: (e.text ?? '').length,
  };
}

export async function handleWriteTextElementsBulk(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: BulkArgs = params;

  if (!args?.program_name) {
    return return_error(new Error('program_name is required'));
  }
  if (!Array.isArray(args?.text_elements) || args.text_elements.length === 0) {
    return return_error(new Error('text_elements must be a non-empty array'));
  }
  if (isCloudConnection()) {
    return return_error(
      new Error('Text elements are not available on ABAP Cloud'),
    );
  }

  // Input validation — fail before any SAP round-trip.
  const perTypeCount: Record<string, number> = {};
  const rRows: BulkEntry[] = [];
  for (const [i, e] of args.text_elements.entries()) {
    if (!e?.type || !['R', 'I', 'S', 'H'].includes(e.type)) {
      return return_error(
        new Error(
          `text_elements[${i}] has missing or unsupported type "${e?.type}"`,
        ),
      );
    }
    if (typeof e.text !== 'string') {
      return return_error(
        new Error(`text_elements[${i}] "text" must be a string`),
      );
    }
    if (e.text.length > MAX_ENTRY_LEN) {
      return return_error(
        new Error(
          `text_elements[${i}] text exceeds ${MAX_ENTRY_LEN} chars (${e.text.length})`,
        ),
      );
    }
    if (e.type === 'I' || e.type === 'S' || e.type === 'H') {
      if (!e.key) {
        return return_error(
          new Error(`text_elements[${i}] type "${e.type}" requires "key"`),
        );
      }
      if (e.type === 'S' && e.key.length > 8) {
        return return_error(
          new Error(
            `text_elements[${i}] selection key "${e.key}" exceeds 8 chars`,
          ),
        );
      }
    }
    perTypeCount[e.type] = (perTypeCount[e.type] ?? 0) + 1;
    if (e.type === 'R') rRows.push(e);
  }
  if (rRows.length > 1) {
    return return_error(
      new Error('Only one R-type entry is allowed per program'),
    );
  }

  const programName = args.program_name.toUpperCase();
  const language = (args.language || '').toUpperCase();
  const replaceExisting = args.replace_existing !== false;
  const shouldActivate = args.activate === true;
  const action: 'WRITE' | 'WRITE_INACTIVE' = shouldActivate
    ? 'WRITE'
    : 'WRITE_INACTIVE';

  const steps: string[] = [];

  logger?.info(
    `WriteTextElementsBulk: ${programName} — ${args.text_elements.length} entries (${JSON.stringify(
      perTypeCount,
    )}); replace_existing=${replaceExisting}; action=${action}`,
  );

  try {
    // Normalize caller input into TPOOL rows.
    const caller: TpoolRow[] = args.text_elements.map((e) =>
      normalizeEntry(e, programName),
    );

    let finalRows: TpoolRow[];
    if (replaceExisting) {
      finalRows = caller;
    } else {
      // Read current pool, merge caller on top by (ID, KEY).
      const { result: fetched } = await callTextpool(connection, 'READ', {
        program: programName,
        language,
      });
      const existing: TpoolRow[] = (Array.isArray(fetched) ? fetched : []).map(
        (r: any) => ({
          ID: String(r?.ID ?? r?.id ?? '').toUpperCase(),
          KEY: String(r?.KEY ?? r?.key ?? ''),
          ENTRY: String(r?.ENTRY ?? r?.entry ?? ''),
          LENGTH: Number(r?.LENGTH ?? r?.length ?? 0),
        }),
      );
      const map = new Map<string, TpoolRow>();
      for (const row of existing) map.set(rowKey(row), row);
      for (const row of caller) map.set(rowKey(row), row);
      finalRows = [...map.values()];
      steps.push('read_existing_for_merge');
    }

    // Single RFC write — regardless of entry count.
    await callTextpool(connection, action, {
      program: programName,
      language,
      textpool_json: JSON.stringify(finalRows),
    });
    steps.push(action === 'WRITE' ? 'write_active' : 'write_inactive');

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          total_entries: args.text_elements.length,
          per_type: perTypeCount,
          total_rows_written: finalRows.length,
          replace_existing: replaceExisting,
          language_used: language || null,
          activate: shouldActivate,
          rfc_action: action,
          steps_completed: steps,
          message: shouldActivate
            ? `Wrote ${finalRows.length} active text element row(s) for ${programName}.`
            : `Staged ${finalRows.length} INACTIVE text element row(s) for ${programName}. Activate the parent program to promote.`,
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
    logger?.error(`WriteTextElementsBulk failed: ${errorMessage}`);
    return return_error(
      new Error(`WriteTextElementsBulk failed: ${errorMessage}`),
    );
  }
}
