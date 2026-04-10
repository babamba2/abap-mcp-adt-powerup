/**
 * GetGuiStatusList Handler - List GUI statuses for an ABAP program
 *
 * Uses ADT object structure API to discover GUI statuses (PROG/PC nodes).
 * Direct REST sub-resource endpoints (/gui_statuses) don't exist in ADT.
 */

import { XMLParser } from 'fast-xml-parser';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
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

    const client = createAdtClient(connection, logger);
    const response = await client
      .getUtils()
      .getObjectStructure('PROG/P', programName);

    const statuses: Array<{
      status_name: string;
      description?: string;
    }> = [];

    if (response.data) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });
      const parsed = parser.parse(response.data);

      let nodes =
        parsed['projectexplorer:objectstructure']?.['projectexplorer:node'];
      if (!nodes) {
        // Program exists but structure has no nodes
        return return_response({
          data: JSON.stringify(
            {
              success: true,
              program_name: programName,
              total_statuses: 0,
              statuses: [],
            },
            null,
            2,
          ),
        } as AxiosResponse);
      }

      if (!Array.isArray(nodes)) nodes = [nodes];

      for (const node of nodes) {
        if (
          node.objecttype === 'PROG/PC' &&
          node.isfolder !== 'true' &&
          node.isfolder !== true
        ) {
          const statusName = String(node.description || '').trim();
          if (statusName) {
            statuses.push({
              status_name: statusName,
            });
          }
        }
      }
    }

    logger?.info(
      `✅ GetGuiStatusList completed: ${programName} (${statuses.length} statuses)`,
    );

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          total_statuses: statuses.length,
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
