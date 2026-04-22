/**
 * DeleteDomain Handler - Delete ABAP Domain via AdtClient
 *
 * Uses AdtClient.getDomain().delete() for high-level delete operation.
 * Includes deletion check before actual deletion.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDdicDoma } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'DeleteDomain',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Delete an ABAP domain from the SAP system. Includes deletion check before actual deletion. Transport request optional for $TMP objects.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_name: {
        type: 'string',
        description: 'Domain name (e.g., Z_MY_DOMAIN).',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Required for transportable objects. Optional for local objects ($TMP).',
      },
    },
    required: ['domain_name'],
  },
} as const;

interface DeleteDomainArgs {
  domain_name: string;
  transport_request?: string;
}

/**
 * Main handler for DeleteDomain MCP tool
 *
 * Uses AdtClient.getDomain().delete() - high-level delete operation with deletion check
 */
export async function handleDeleteDomain(
  context: HandlerContext,
  args: DeleteDomainArgs,
) {
  const { connection, logger } = context;
  try {
    const { domain_name, transport_request } = args as DeleteDomainArgs;

    // Validation
    if (!domain_name) {
      return return_error(new Error('domain_name is required'));
    }

    const domainName = domain_name.toUpperCase();

    // ECC fallback — see handleCreateDomain for rationale.
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      return handleDeleteDomainEcc(context, domainName, transport_request);
    }

    const client = createAdtClient(connection, logger);

    logger?.info(`Starting domain deletion: ${domainName}`);

    try {
      // Delete domain using AdtClient (includes deletion check)
      const domainObject = client.getDomain();
      const deleteResult = await domainObject.delete({
        domainName,
        transportRequest: transport_request,
      });

      if (!deleteResult || !deleteResult.deleteResult) {
        throw new Error(
          `Delete did not return a response for domain ${domainName}`,
        );
      }

      logger?.info(`✅ DeleteDomain completed successfully: ${domainName}`);

      return return_response({
        data: JSON.stringify(
          {
            success: true,
            domain_name: domainName,
            transport_request: transport_request || null,
            message: `Domain ${domainName} deleted successfully.`,
          },
          null,
          2,
        ),
      } as AxiosResponse);
    } catch (error: any) {
      logger?.error(
        `Error deleting domain ${domainName}: ${error?.message || error}`,
      );

      // Parse error message
      let errorMessage = `Failed to delete domain: ${error.message || String(error)}`;

      if (error.response?.status === 404) {
        errorMessage = `Domain ${domainName} not found. It may already be deleted.`;
      } else if (error.response?.status === 423) {
        errorMessage = `Domain ${domainName} is locked by another user. Cannot delete.`;
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

/**
 * ECC fallback for DeleteDomain. Calls ZMCP_ADT_DDIC_DOMA with
 * action='DELETE' which wraps RS_DD_DELETE_OBJ server-side.
 */
async function handleDeleteDomainEcc(
  context: HandlerContext,
  domainName: string,
  transportRequest: string | undefined,
) {
  const { connection, logger } = context;
  try {
    logger?.info(`ECC: deleting domain ${domainName} via ZMCP_ADT_DDIC_DOMA`);

    await callDdicDoma(connection, 'DELETE', {
      name: domainName,
      transport: transportRequest,
    });

    logger?.info(`✅ DeleteDomain (ECC) completed: ${domainName}`);

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          domain_name: domainName,
          transport_request: transportRequest || null,
          message: `Domain ${domainName} deleted successfully (ECC fallback via OData).`,
          path: 'ecc-odata-rfc',
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    logger?.error(
      `ECC DeleteDomain error for ${domainName}: ${error?.message || error}`,
    );
    return return_error(
      new Error(
        `Failed to delete domain ${domainName} (ECC fallback): ${error?.message || String(error)}`,
      ),
    );
  }
}
