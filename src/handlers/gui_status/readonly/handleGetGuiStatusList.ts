/**
 * GetGuiStatusList Handler - List GUI statuses for an ABAP program
 *
 * Uses ADT object structure API to discover GUI statuses (PROG/PC nodes).
 * Direct REST sub-resource endpoints (/gui_statuses) don't exist in ADT.
 *
 * The object structure only lists statuses the workbench navigation index
 * knows about. A CUA written through the dispatcher (CUA_WRITE) is not in
 * that index (seen on BASIS 7.40), so when ADT lists none — or the structure
 * call fails for a reason other than "program not found" — the list is
 * derived from the CUA_FETCH STA rows instead.
 */

import { XMLParser } from 'fast-xml-parser';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDispatch } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  isCloudConnection,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'GetGuiStatusList',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only] List all GUI statuses belonging to an ABAP program.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Program name (e.g., SAPMV45A).',
      },
    },
    required: ['program_name'],
  },
} as const;

export interface GuiStatusListEntry {
  status_name: string;
  description?: string;
  status_type?: string;
}

/** PROG/PC leaf nodes of an ADT object structure document. */
export function parseStatusesFromStructure(xml: string): GuiStatusListEntry[] {
  if (!xml || typeof xml !== 'string') return [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xml);
  let nodes = parsed?.objectstructure?.node;
  if (!nodes) return [];
  if (!Array.isArray(nodes)) nodes = [nodes];
  const out: GuiStatusListEntry[] = [];
  for (const node of nodes) {
    if (
      node?.objecttype === 'PROG/PC' &&
      node.isfolder !== 'true' &&
      node.isfolder !== true
    ) {
      const statusName = String(node.description || '').trim();
      if (statusName) out.push({ status_name: statusName });
    }
  }
  return out;
}

/** STA rows of a CUA_FETCH result (keys may be upper or lower case). */
export function statusesFromCua(cua: any): GuiStatusListEntry[] {
  const sta = cua?.STA ?? cua?.sta;
  if (!Array.isArray(sta)) return [];
  const out: GuiStatusListEntry[] = [];
  for (const row of sta) {
    const code = String(row?.CODE ?? row?.code ?? '').trim();
    if (!code) continue;
    const note = String(row?.INT_NOTE ?? row?.int_note ?? '').trim();
    const modal = row?.MODAL ?? row?.modal;
    const entry: GuiStatusListEntry = { status_name: code };
    if (note) entry.description = note;
    if (modal !== undefined) entry.status_type = String(modal);
    out.push(entry);
  }
  return out;
}

export async function handleGetGuiStatusList(
  context: HandlerContext,
  args: { program_name: string },
) {
  const { connection, logger } = context;
  try {
    const { program_name } = args;
    if (!program_name) {
      return return_error(new Error('program_name is required'));
    }

    if (isCloudConnection()) {
      return return_error(
        new Error(
          'GUI Statuses are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
        ),
      );
    }

    const programName = program_name.toUpperCase();
    logger?.info(`Listing GUI statuses for program: ${programName}`);

    let statuses: GuiStatusListEntry[] = [];
    let source: 'adt_object_structure' | 'cua_fetch' = 'adt_object_structure';
    const notes: string[] = [];
    let adtError: any;

    try {
      const client = createAdtClient(connection, logger);
      const response = await client
        .getUtils()
        .getObjectStructure('PROG/P', programName);
      statuses = parseStatusesFromStructure(
        typeof response.data === 'string' ? response.data : '',
      );
    } catch (error: any) {
      if (error?.response?.status === 404) throw error;
      adtError = error;
    }

    if (statuses.length === 0) {
      try {
        const { result } = await callDispatch(connection, 'CUA_FETCH', {
          program: programName,
        });
        const fromCua = statusesFromCua(result);
        if (fromCua.length > 0) {
          statuses = fromCua;
          source = 'cua_fetch';
          notes.push(
            'ADT object structure listed no GUI statuses; list derived from CUA_FETCH (STA rows).',
          );
        }
      } catch (cuaError: any) {
        if (adtError) throw adtError;
        notes.push(
          `CUA_FETCH fallback unavailable: ${cuaError?.message || String(cuaError)}`,
        );
      }
    }

    logger?.info(
      `✅ GetGuiStatusList completed: ${programName} (${statuses.length} statuses, source=${source})`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          total_statuses: statuses.length,
          source,
          ...(notes.length ? { notes } : {}),
          statuses,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    if (error.response?.status === 404) {
      errorMessage = `Program ${args?.program_name} not found.`;
    }
    logger?.error(`Error listing GUI statuses: ${errorMessage}`);
    return return_error(new Error(errorMessage));
  }
}
