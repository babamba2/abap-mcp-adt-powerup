/**
 * CreateTable Handler - ABAP Table Creation via ADT API
 *
 * Workflow: validate -> create (object in initial state)
 * DDL code is set via UpdateTable handler.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  ErrorCode,
  McpError,
  return_error,
  return_response,
} from '../../../lib/utils';
import { validateTransportRequest } from '../../../utils/transportValidation.js';

export const TOOL_DEFINITION = {
  name: 'CreateTable',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Create a new ABAP table via the ADT API. Creates the table object in initial state. Use UpdateTable to set DDL code afterwards.',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description:
          'Table name (e.g., ZZ_TEST_TABLE_001). Must follow SAP naming conventions.',
      },
      description: {
        type: 'string',
        description: 'Table description for validation and creation.',
      },
      package_name: {
        type: 'string',
        description: 'Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
      },
      transport_request: {
        type: 'string',
        description:
          'Transport request number (e.g., E19K905635). Required for transportable packages.',
      },
    },
    required: ['table_name', 'package_name'],
  },
} as const;

interface CreateTableArgs {
  table_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
}

/**
 * Main handler for CreateTable MCP tool
 */
export async function handleCreateTable(
  context: HandlerContext,
  args: CreateTableArgs,
): Promise<any> {
  const { connection, logger } = context;
  try {
    const createTableArgs = args as CreateTableArgs;

    // Validate required parameters
    if (!createTableArgs?.table_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
    }
    if (!createTableArgs?.package_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
    }

    // Validate transport_request: required for non-$TMP packages
    validateTransportRequest(
      createTableArgs.package_name,
      createTableArgs.transport_request,
    );

    const tableName = createTableArgs.table_name.toUpperCase();

    // ECC fallback — the S/4HANA ADT path here builds a CDS-style DDL
    // skeleton (`define table ... { key mandt : mandt not null; }`),
    // which ECC's DDIC write layer does not accept (ECC DD02V/DD03P
    // is row-based, not CDS-source-based). A full CDS-DDL → DD03P
    // translator would be non-trivial, so CreateTable on ECC is
    // deliberately not implemented. Users should call the OData
    // DdicTabl FunctionImport directly with a DD02V+DD03P JSON
    // payload (see sc4sap/abap/zmcp_adt_ddic_tabl_ecc.abap header
    // for schema).
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      throw new McpError(
        ErrorCode.InvalidParams,
        `CreateTable is not supported on ECC via this MCP tool. ` +
          `ECC's DDIC write layer is row-based (DD02V + DD03P) and does not accept ` +
          `the S/4HANA CDS-style DDL skeleton this handler generates. ` +
          `Call the OData FunctionImport /DdicTabl on ZMCP_ADT_SRV directly with ` +
          `IV_ACTION='CREATE' and IV_PAYLOAD_JSON = '{"dd02v":{...},"dd03p":[...]}'.`,
      );
    }

    logger?.info(`Starting table creation: ${tableName}`);

    try {
      // Create client
      const client = createAdtClient(connection);

      // Validate
      await client.getTable().validate({
        tableName,
        packageName: createTableArgs.package_name,
        description: createTableArgs.description || tableName,
      });

      // Create
      await client.getTable().create({
        tableName,
        packageName: createTableArgs.package_name,
        description: createTableArgs.description || tableName,
        ddlCode: '',
        transportRequest: createTableArgs.transport_request,
      });

      logger?.info(`Table created: ${tableName}`);

      // Replace SAP backend's auto-generated CDS-style skeleton (`key client : abap.clnt`)
      // with the correct transparent-table skeleton using the MANDT data element.
      // Without this follow-up, first-time users hit `ExceptionResourceAlreadyExists`
      // (SBD_MESSAGES/007) on UpdateTable when their DDL uses `mandt : mandt` —
      // the normal transparent-table pattern used by every standard SAP table
      // (MARA, T001, VBAK, …). CDS views use `abap.clnt`; transparent tables don't.
      const labelText = (createTableArgs.description || tableName).replace(
        /'/g,
        "''",
      );
      const defaultDdl = `@EndUserText.label : '${labelText}'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table ${tableName.toLowerCase()} {
  key mandt : mandt not null;
}`;

      let skeletonApplied = false;
      try {
        const lockHandle = await client.getTable().lock({ tableName });
        try {
          await client.getTable().update(
            {
              tableName,
              ddlCode: defaultDdl,
              transportRequest: createTableArgs.transport_request,
            },
            { lockHandle },
          );
          skeletonApplied = true;
          logger?.info(
            `[CreateTable] Applied MANDT-based transparent-table skeleton: ${tableName}`,
          );
        } finally {
          try {
            await client.getTable().unlock({ tableName }, lockHandle);
          } catch (unlockError: any) {
            logger?.warn(
              `[CreateTable] Failed to unlock ${tableName} after skeleton apply: ${unlockError?.message || unlockError}`,
            );
          }
        }
      } catch (skelError: any) {
        // Non-fatal: the table exists and works; user's UpdateTable must then
        // preserve SAP's default `client : abap.clnt` skeleton instead.
        logger?.warn(
          `[CreateTable] Failed to apply MANDT skeleton for ${tableName} — leaving SAP default (abap.clnt). UpdateTable DDL must use 'key client : abap.clnt not null' + '#RESTRICTED' + '#NOT_EXTENSIBLE'. Error: ${skelError?.message || skelError}`,
        );
      }

      return return_response({
        data: JSON.stringify({
          success: true,
          table_name: tableName,
          package_name: createTableArgs.package_name,
          transport_request: createTableArgs.transport_request || 'local',
          skeleton: skeletonApplied ? 'mandt' : 'client-fallback',
          message: skeletonApplied
            ? `Table ${tableName} created with MANDT skeleton. Use UpdateTable to add fields (preserve #NOT_EXTENSIBLE, #RESTRICTED, and 'key mandt : mandt not null').`
            : `Table ${tableName} created (MANDT skeleton apply FAILED — SAP default 'key client : abap.clnt' applies). Use UpdateTable carefully preserving the CDS-style skeleton.`,
        }),
      } as AxiosResponse);
    } catch (error: any) {
      logger?.error(
        `Error creating table ${tableName}: ${error?.message || error}`,
      );

      // Check if table already exists
      if (
        error.message?.includes('already exists') ||
        error.response?.status === 409
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Table ${tableName} already exists. Please delete it first or use a different name.`,
        );
      }

      const errorMessage = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data)
        : error.message || String(error);

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create table ${tableName}: ${errorMessage}`,
      );
    }
  } catch (error: any) {
    if (error instanceof McpError) {
      throw error;
    }
    return return_error(error);
  }
}
