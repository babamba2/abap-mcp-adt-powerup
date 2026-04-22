/**
 * DeleteTable Handler - Delete ABAP Table via AdtClient
 *
 * Uses AdtClient.getTable().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDdicTabl } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'DeleteTable',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Delete an ABAP table from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'Table name (e.g., Z_MY_TABLE).',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
      },
    },
    required: ['table_name'],
  },
} as const;

interface DeleteTableArgs {
  table_name: string;
  transport_request?: string;
}

/**
 * Main handler for DeleteTable MCP tool
 *
 * Uses AdtClient.getTable().delete() - high-level delete operation with deletion check
 */
export async function handleDeleteTable(
  context: HandlerContext,
  args: DeleteTableArgs,
) {
  const { connection, logger } = context;
  try {
    const { table_name, transport_request } = args as DeleteTableArgs;

    // Validation
    if (!table_name) {
      return return_error(new Error('table_name is required'));
    }

    const tableName = table_name.toUpperCase();

    // ECC fallback — Delete doesn't need payload parsing so we can
    // route through the RFC path unchanged.
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      return handleDeleteTableEcc(context, tableName, transport_request);
    }

    const client = createAdtClient(connection, logger);

    logger?.info(`Starting table deletion: ${tableName}`);

    try {
      // Delete table using AdtClient (includes deletion check)
      const tableObject = client.getTable();
      const deleteResult = await tableObject.delete({
        tableName,
        transportRequest: transport_request,
      });

      if (!deleteResult || !deleteResult.deleteResult) {
        throw new Error(
          `Delete did not return a response for table ${tableName}`,
        );
      }

      logger?.info(`✅ DeleteTable completed successfully: ${tableName}`);

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            table_name: tableName,
            transport_request: transport_request || null,
            message: `Table ${tableName} deleted successfully.`,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      logger?.error(
        `Error deleting table ${tableName}: ${error?.message || error}`,
      );

      // Parse error message
      let errorMessage = `Failed to delete table: ${error.message || String(error)}`;

      if (error.response?.status === 404) {
        errorMessage = `Table ${tableName} not found. It may already be deleted.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Table ${tableName} is locked by another user. Cannot delete.`;
      } else if (error.response?.status === 400) {
        errorMessage = `Bad request. Check if transport request is required and valid.`;
      } else if (
        error.response?.data &&
        typeof error.response.data === 'string'
      ) {
        try {
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
          });
          const errorData = parser.parse(error.response.data);
          const errorMsg =
            errorData['exc:exception']?.message?.['#text'] ||
            errorData['exc:exception']?.message;
          if (errorMsg) {
            errorMessage = `SAP Error: ${errorMsg}`;
          }
        } catch (_parseError) {
          // Ignore parse errors
        }
      }

      return return_error(new Error(errorMessage));
    }
  } catch (error: any) {
    return return_error(error);
  }
}

/** ECC fallback for DeleteTable via ZMCP_ADT_DDIC_TABL action='DELETE'. */
async function handleDeleteTableEcc(
  context: HandlerContext,
  tableName: string,
  transportRequest: string | undefined,
) {
  const { connection, logger } = context;
  try {
    logger?.info(`ECC: deleting table ${tableName} via ZMCP_ADT_DDIC_TABL`);

    await callDdicTabl(connection, 'DELETE', {
      name: tableName,
      transport: transportRequest,
    });

    logger?.info(`✅ DeleteTable (ECC) completed: ${tableName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          table_name: tableName,
          transport_request: transportRequest || null,
          message: `Table ${tableName} deleted successfully (ECC fallback via OData).`,
          path: 'ecc-odata-rfc',
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    logger?.error(
      `ECC DeleteTable error for ${tableName}: ${error?.message || error}`,
    );
    return return_error(
      new Error(
        `Failed to delete table ${tableName} (ECC fallback): ${error?.message || String(error)}`,
      ),
    );
  }
}
