/**
 * DeleteStructure Handler - Delete ABAP Structure via AdtClient
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
  name: 'DeleteStructure',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Delete an ABAP structure from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
  inputSchema: {
    type: 'object',
    properties: {
      structure_name: {
        type: 'string',
        description: 'Structure name (e.g., Z_MY_STRUCTURE).',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request. Required unless the object is local ($TMP).',
      },
    },
    required: ['structure_name'],
  },
} as const;

interface DeleteStructureArgs {
  structure_name: string;
  transport_request?: string;
}

export async function handleDeleteStructure(
  context: HandlerContext,
  args: DeleteStructureArgs,
) {
  const { connection, logger } = context;
  try {
    const { structure_name, transport_request } = args as DeleteStructureArgs;

    if (!structure_name) {
      return return_error(new Error('structure_name is required'));
    }

    const structureName = structure_name.toUpperCase();

    // ECC: no /sap/bc/adt/ddic/structures endpoint. A structure is a TABL
    // object in the DDIC, so ZMCP_ADT_DDIC_TABL DELETE removes it.
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      try {
        logger?.info(
          `ECC: deleting structure ${structureName} via ZMCP_ADT_DDIC_TABL`,
        );
        await callDdicTabl(connection, 'DELETE', {
          name: structureName,
          transport: transport_request,
        });
        return return_response({
          data: JSON.stringify(
            {
              success: true,
              structure_name: structureName,
              transport_request: transport_request || null,
              message: `Structure ${structureName} deleted successfully (ECC fallback via OData).`,
              path: 'ecc-odata-rfc',
            },
            null,
            2,
          ),
        } as AxiosResponse);
      } catch (error: any) {
        return return_error(
          new Error(
            `Failed to delete structure ${structureName} (ECC fallback): ${error?.message || String(error)}`,
          ),
        );
      }
    }

    const client = createAdtClient(connection, logger);
    logger?.info(`Starting structure deletion: ${structureName}`);

    try {
      const structureObject = client.getStructure();
      const deleteResult = await structureObject.delete({
        structureName,
        transportRequest: transport_request,
      });

      if (!deleteResult || !deleteResult.deleteResult) {
        throw new Error(
          `Delete did not return a response for structure ${structureName}`,
        );
      }

      logger?.info(
        `✅ DeleteStructure completed successfully: ${structureName}`,
      );

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            structure_name: structureName,
            transport_request: transport_request || null,
            message: `Structure ${structureName} deleted successfully.`,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      logger?.error(
        `Error deleting structure ${structureName}: ${error?.message || error}`,
      );

      let errorMessage = `Failed to delete structure: ${error.message || String(error)}`;

      if (error.response?.status === 404) {
        errorMessage = `Structure ${structureName} not found. It may already be deleted.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Structure ${structureName} is locked by another user. Cannot delete.`;
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
