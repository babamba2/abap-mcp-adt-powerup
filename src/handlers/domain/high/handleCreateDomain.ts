/**
 * CreateDomain Handler - ABAP Domain Creation via ADT API
 *
 * Uses DomainBuilder from @babamba2/mcp-abap-adt-clients for all operations.
 * Session and lock management handled internally by builder.
 *
 * Workflow: create -> check -> unlock -> (activate)
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import { callDdicActivate, callDdicDoma } from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  ErrorCode,
  McpError,
  return_error,
  return_response,
  safeCheckOperation,
} from '../../../lib/utils';
import { validateTransportRequest } from '../../../utils/transportValidation';

export const TOOL_DEFINITION = {
  name: 'CreateDomain',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Create a new ABAP domain in SAP system with all required steps: lock, create, check, unlock, activate, and verify.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_name: {
        type: 'string',
        description:
          'Domain name (e.g., ZZ_TEST_0001). Must follow SAP naming conventions.',
      },
      description: {
        type: 'string',
        description:
          '(optional) Domain description. If not provided, domain_name will be used.',
      },
      package_name: {
        type: 'string',
        description:
          '(optional) Package name (e.g., ZOK_LOCAL, $TMP for local objects)',
      },
      transport_request: {
        type: 'string',
        description:
          '(optional) Transport request number (e.g., E19K905635). Required for transportable packages.',
      },
      datatype: {
        type: 'string',
        description:
          '(optional) Data type: CHAR, NUMC, DATS, TIMS, DEC, INT1, INT2, INT4, INT8, CURR, QUAN, etc.',
        default: 'CHAR',
      },
      length: {
        type: 'number',
        description: '(optional) Field length (max depends on datatype)',
        default: 100,
      },
      decimals: {
        type: 'number',
        description: '(optional) Decimal places (for DEC, CURR, QUAN types)',
        default: 0,
      },
      conversion_exit: {
        type: 'string',
        description:
          '(optional) Conversion exit routine name (without CONVERSION_EXIT_ prefix)',
      },
      lowercase: {
        type: 'boolean',
        description: '(optional) Allow lowercase input',
        default: false,
      },
      sign_exists: {
        type: 'boolean',
        description: '(optional) Field has sign (+/-)',
        default: false,
      },
      value_table: {
        type: 'string',
        description: '(optional) Value table name for foreign key relationship',
      },
      activate: {
        type: 'boolean',
        description:
          '(optional) Activate domain after creation (default: true)',
        default: true,
      },
      fixed_values: {
        type: 'array',
        description: '(optional) Array of fixed values for domain value range',
        items: {
          type: 'object',
          properties: {
            low: {
              type: 'string',
              description: "Fixed value (e.g., '001', 'A')",
            },
            text: {
              type: 'string',
              description: 'Description text for the fixed value',
            },
          },
          required: ['low', 'text'],
        },
      },
    },
    required: ['domain_name'],
  },
} as const;

interface DomainArgs {
  domain_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  datatype?: string;
  length?: number;
  decimals?: number;
  conversion_exit?: string;
  lowercase?: boolean;
  sign_exists?: boolean;
  value_table?: string;
  activate?: boolean;
  fixed_values?: Array<{ low: string; text: string }>;
  super_package?: string;
}

/**
 * Main handler for CreateDomain MCP tool
 *
 * Uses DomainBuilder from @babamba2/mcp-abap-adt-clients for all operations
 * Session and lock management handled internally by builder
 */
export async function handleCreateDomain(
  context: HandlerContext,
  args: DomainArgs,
) {
  const { connection, logger } = context;
  try {
    // Validate required parameters
    if (!args?.domain_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Domain name is required');
    }
    if (!args?.package_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Package name is required');
    }

    // Validate transport_request: required for non-$TMP, non-ZLOCAL packages
    validateTransportRequest(
      args.package_name,
      args.transport_request,
      args.super_package,
    );

    const typedArgs = args as DomainArgs;
    const domainName = typedArgs.domain_name.toUpperCase();

    // ECC fallback: ADT REST does not expose /sap/bc/adt/ddic/domains
    // on BASIS < 7.50. Route through the ZMCP_ADT_DDIC_DOMA OData
    // FunctionImport which calls DDIF_DOMA_PUT + DDIF_DOMA_ACTIVATE
    // server-side (see sc4sap/abap/zmcp_adt_ddic_doma_ecc.abap).
    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      return handleCreateDomainEcc(context, typedArgs, domainName);
    }

    logger?.info(`Starting domain creation: ${domainName}`);

    let lockHandle: string | undefined;
    const client = createAdtClient(connection);
    try {
      const shouldActivate = typedArgs.activate !== false; // Default to true if not specified

      // Validate
      await client.getDomain().validate({
        domainName,
        packageName: typedArgs.package_name,
        description: typedArgs.description || domainName,
      });

      // Create
      const createState = await client.getDomain().create({
        domainName,
        description: typedArgs.description || domainName,
        packageName: typedArgs.package_name,
        transportRequest: typedArgs.transport_request,
      });

      // Lock
      lockHandle = await client.getDomain().lock({ domainName });

      // Update with properties
      await client.getDomain().update(
        {
          domainName,
          packageName: typedArgs.package_name,
          description: typedArgs.description || domainName,
          datatype: typedArgs.datatype || 'CHAR',
          length: typedArgs.length || 100,
          decimals: typedArgs.decimals || 0,
          conversion_exit: typedArgs.conversion_exit,
          lowercase: typedArgs.lowercase || false,
          sign_exists: typedArgs.sign_exists || false,
          value_table: typedArgs.value_table,
          fixed_values: typedArgs.fixed_values,
          transportRequest: typedArgs.transport_request,
        },
        { lockHandle },
      );

      // Check
      try {
        await safeCheckOperation(
          () => client.getDomain().check({ domainName }),
          domainName,
          {
            debug: (message: string) => logger?.debug(message),
          },
        );
      } catch (checkError: any) {
        // If error was marked as "already checked", continue silently
        if ((checkError as any).isAlreadyChecked) {
          logger?.debug(
            `Domain ${domainName} was already checked - continuing`,
          );
        } else {
          // Real check error - rethrow
          throw checkError;
        }
      }

      // Unlock
      await client.getDomain().unlock({ domainName }, lockHandle);

      // Activate if requested
      if (shouldActivate) {
        await client.getDomain().activate({ domainName });
      } else {
        logger?.debug(`Skipping activation for: ${domainName}`);
      }

      // Get domain details from create result (createDomain already does verification)
      const createResult = createState.createResult;
      let domainDetails = null;
      if (
        createResult?.data &&
        typeof createResult.data === 'object' &&
        'domain_details' in createResult.data
      ) {
        domainDetails = (createResult.data as any).domain_details;
      }

      logger?.info(`✅ CreateDomain completed: ${domainName}`);

      return return_response({
        data: JSON.stringify({
          success: true,
          domain_name: domainName,
          package: typedArgs.package_name,
          transport_request: typedArgs.transport_request,
          status: shouldActivate ? 'active' : 'inactive',
          message: `Domain ${domainName} created${shouldActivate ? ' and activated' : ''} successfully`,
          domain_details: domainDetails,
        }),
      } as AxiosResponse);
    } catch (error: any) {
      // Try to unlock if lock was acquired
      if (lockHandle) {
        try {
          await client.getDomain().unlock({ domainName }, lockHandle);
          logger?.debug(`Unlocked domain ${domainName} after error`);
        } catch (_unlockError) {
          // Ignore unlock errors
        }
      }

      logger?.error(
        `Error creating domain ${domainName}: ${error?.message || error}`,
      );

      // Check if domain already exists
      if (
        error.message?.includes('already exists') ||
        error.response?.data?.includes('ExceptionResourceAlreadyExists')
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Domain ${domainName} already exists. Please delete it first or use a different name.`,
        );
      }

      // Safely extract error message
      let errorMessage: string;
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else {
          try {
            errorMessage = JSON.stringify(error.response.data);
          } catch (_e) {
            errorMessage = String(error.response.data).substring(0, 500);
          }
        }
      } else {
        errorMessage = error.message || String(error);
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create domain ${domainName}: ${errorMessage}`,
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    return return_error(error);
  }
}

/**
 * ECC fallback path for CreateDomain.
 *
 * Invoked only when SAP_VERSION=ECC. Packs the args into a DD01V +
 * DD07V JSON envelope and calls the ZMCP_ADT_DDIC_DOMA OData
 * FunctionImport (action='CREATE'), then optionally DdicActivate.
 *
 * Intentionally mirrors the S/4HANA handler's return_response shape so
 * downstream consumers see the same JSON structure regardless of path.
 */
async function handleCreateDomainEcc(
  context: HandlerContext,
  args: DomainArgs,
  domainName: string,
) {
  const { connection, logger } = context;
  const shouldActivate = args.activate !== false;

  const length = args.length ?? 100;
  const decimals = args.decimals ?? 0;
  const pad6 = (n: number) => String(n).padStart(6, '0');
  const pad4 = (n: number) => String(n).padStart(4, '0');

  const dd01v: Record<string, string> = {
    DOMNAME: domainName,
    DDLANGUAGE: 'E',
    DATATYPE: (args.datatype || 'CHAR').toUpperCase(),
    LENG: pad6(length),
    DECIMALS: pad6(decimals),
    OUTPUTLEN: pad6(length),
    DDTEXT: args.description || domainName,
    LOWERCASE: args.lowercase ? 'X' : '',
    SIGNFLAG: args.sign_exists ? 'X' : '',
    CONVEXIT: args.conversion_exit || '',
    VALEXI: args.fixed_values && args.fixed_values.length > 0 ? 'X' : '',
    ENTITYTAB: args.value_table || '',
  };

  const dd07v = (args.fixed_values || []).map((fv, i) => ({
    DOMNAME: domainName,
    VALPOS: pad4(i + 1),
    DDLANGUAGE: 'E',
    DOMVALUE_L: fv.low,
    DDTEXT: fv.text,
  }));

  const payload_json = JSON.stringify({ dd01v, dd07v });

  try {
    logger?.info(`ECC: creating domain ${domainName} via ZMCP_ADT_DDIC_DOMA`);

    const putRes = await callDdicDoma(connection, 'CREATE', {
      name: domainName,
      devclass: args.package_name,
      transport: args.transport_request,
      payload_json,
    });
    logger?.debug(`DdicDoma CREATE → ${putRes.message}`);

    if (shouldActivate) {
      const actRes = await callDdicActivate(connection, 'DOMA', domainName);
      logger?.debug(`DdicActivate DOMA → ${actRes.message}`);
    }

    logger?.info(`✅ CreateDomain (ECC) completed: ${domainName}`);

    return return_response({
      data: JSON.stringify({
        success: true,
        domain_name: domainName,
        package: args.package_name,
        transport_request: args.transport_request,
        status: shouldActivate ? 'active' : 'inactive',
        message: `Domain ${domainName} created${shouldActivate ? ' and activated' : ''} successfully (ECC fallback via OData)`,
        domain_details: null,
        path: 'ecc-odata-rfc',
      }),
    } as AxiosResponse);
  } catch (error: any) {
    logger?.error(
      `ECC CreateDomain error for ${domainName}: ${error?.message || error}`,
    );
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create domain ${domainName} (ECC fallback): ${error?.message || String(error)}`,
    );
  }
}
