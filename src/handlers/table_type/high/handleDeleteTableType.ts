/**
 * DeleteTableType — DDIC table type (TTYP).
 * S/4HANA via ADT (client library); ECC via ZMCP_ADT_DDIC_TTYP DELETE.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  callDdicTtyp,
  eccBridgePath,
  eccBridgeVia,
} from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'DeleteTableType',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Delete a DDIC table type (TTYP). Transport request optional for $TMP objects.',
  inputSchema: {
    type: 'object',
    properties: {
      table_type_name: { type: 'string', description: 'Table type name.' },
      transport_request: {
        type: 'string',
        description:
          'Transport request. Required unless the object is local ($TMP).',
      },
    },
    required: ['table_type_name'],
  },
} as const;

interface DeleteTableTypeArgs {
  table_type_name: string;
  transport_request?: string;
}

export async function handleDeleteTableType(
  context: HandlerContext,
  args: DeleteTableTypeArgs,
) {
  const { connection, logger } = context;
  const name = (args?.table_type_name ?? '').toUpperCase();
  if (!name) return return_error(new Error('table_type_name is required'));
  try {
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      await callDdicTtyp(connection, 'DELETE', {
        name,
        transport: args.transport_request,
      });
    } else {
      const client = createAdtClient(connection, logger);
      await client.getTableType().delete({
        tableTypeName: name,
        transportRequest: args.transport_request,
      });
    }
    const ecc = process.env.SAP_VERSION?.toUpperCase() === 'ECC';
    return return_response({
      data: JSON.stringify(
        {
          success: true,
          table_type_name: name,
          transport_request: args.transport_request || null,
          message: `Table type ${name} deleted successfully${ecc ? ` (ECC fallback via ${eccBridgeVia()})` : ''}.`,
          ...(ecc ? { path: eccBridgePath() } : {}),
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    return return_error(
      new Error(
        `Failed to delete table type ${name}: ${error?.message || String(error)}`,
      ),
    );
  }
}
