/**
 * CreateTableType — DDIC table type (TTYP).
 *
 * S/4HANA: ADT /sap/bc/adt/ddic/tabletypes via the client library
 *          (create → update with row type → activate).
 * ECC:     ADT has no DDIC endpoints below BASIS 7.50, so the header (DD40V)
 *          and key components (DD42V) go to ZMCP_ADT_DDIC_TTYP
 *          (OData FunctionImport DdicTtyp), then ZMCP_ADT_DDIC_ACTIVATE.
 */

import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  callDdicActivate,
  callDdicTtyp,
  eccBridgePath,
  eccBridgeVia,
} from '../../../lib/rfcBackend';
import {
  type AxiosResponse,
  ErrorCode,
  McpError,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'CreateTableType',
  available_in: ['onprem', 'cloud'] as const,
  description:
    'Create a DDIC table type (TTYP) with its row type, access mode and primary key, and activate it. S/4HANA via ADT; ECC via ZMCP_ADT_DDIC_TTYP (needs the ECC DDIC FMs from setup and SAP_RFC_BACKEND=odata or nco).',
  inputSchema: {
    type: 'object',
    properties: {
      table_type_name: {
        type: 'string',
        description:
          'Table type name (e.g., ZSD_T_ORDER_ITEMS). Z/Y namespace, max 30 characters.',
      },
      description: {
        type: 'string',
        description: 'Short text (max 60 characters).',
      },
      package_name: {
        type: 'string',
        description: 'Package ($TMP for local objects).',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request. Required for transportable packages.',
      },
      row_type: {
        type: 'string',
        description:
          'Row type name: a structure / table, a data element, or another table type.',
      },
      row_kind: {
        type: 'string',
        enum: ['structure', 'data_element', 'table_type'],
        description: 'What row_type is. Default structure.',
      },
      access_type: {
        type: 'string',
        enum: ['standard', 'sorted', 'hashed', 'index', 'any'],
        description: 'Access mode. Default standard.',
      },
      key_definition: {
        type: 'string',
        enum: ['standard', 'row_type', 'key_components', 'none'],
        description: 'Primary key definition. Default standard (standard key).',
      },
      key_kind: {
        type: 'string',
        enum: ['non_unique', 'unique', 'not_specified'],
        description:
          'Primary key category. Default non_unique; hashed tables need unique.',
      },
      key_components: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Key fields of the row type, in order. Only with key_definition=key_components (ECC).',
      },
      activate: {
        type: 'boolean',
        description: 'Activate after create. Default true.',
      },
    },
    required: ['table_type_name', 'package_name', 'row_type'],
  },
} as const;

export interface CreateTableTypeArgs {
  table_type_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  row_type: string;
  row_kind?: 'structure' | 'data_element' | 'table_type';
  access_type?: 'standard' | 'sorted' | 'hashed' | 'index' | 'any';
  key_definition?: 'standard' | 'row_type' | 'key_components' | 'none';
  key_kind?: 'non_unique' | 'unique' | 'not_specified';
  key_components?: string[];
  activate?: boolean;
}

const ROW_KIND = {
  structure: 'S',
  data_element: 'E',
  table_type: 'L',
} as const;
const ACCESS = {
  standard: 'T',
  sorted: 'S',
  hashed: 'H',
  index: 'I',
  any: 'A',
} as const;
const KEY_DEF = {
  standard: 'D',
  row_type: 'T',
  key_components: 'K',
  none: 'G',
} as const;
const KEY_KIND = { non_unique: 'N', unique: 'U', not_specified: 'G' } as const;

const NAME_RE = /^[A-Z/][A-Z0-9_/]{0,29}$/;
const FIELD_RE = /^[A-Z][A-Z0-9_]{0,29}$/;

/** Validates the arguments and fills defaults. Exported for unit tests. */
export function normalizeTableTypeArgs(args: CreateTableTypeArgs) {
  const name = (args.table_type_name ?? '').toUpperCase();
  const rowType = (args.row_type ?? '').toUpperCase();
  if (!NAME_RE.test(name)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid table type name "${args.table_type_name}".`,
    );
  }
  if (!NAME_RE.test(rowType)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid row type "${args.row_type}".`,
    );
  }
  const rowKind = args.row_kind ?? 'structure';
  const access = args.access_type ?? 'standard';
  const keyDef = args.key_definition ?? 'standard';
  const keyKind =
    args.key_kind ?? (access === 'hashed' ? 'unique' : 'non_unique');
  const keys = (args.key_components ?? []).map((k) => k.toUpperCase());

  for (const [value, map, label] of [
    [rowKind, ROW_KIND, 'row_kind'],
    [access, ACCESS, 'access_type'],
    [keyDef, KEY_DEF, 'key_definition'],
    [keyKind, KEY_KIND, 'key_kind'],
  ] as const) {
    if (!(value in map)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown ${label} "${value}".`,
      );
    }
  }
  if (access === 'hashed' && keyKind !== 'unique') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'A hashed table type needs key_kind=unique.',
    );
  }
  if (keyDef === 'key_components') {
    if (keys.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'key_definition=key_components needs key_components (field names of the row type).',
      );
    }
    const bad = keys.find((k) => !FIELD_RE.test(k));
    if (bad)
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid key component "${bad}".`,
      );
    if (rowKind !== 'structure') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'key_components need a structured row type (row_kind=structure).',
      );
    }
  } else if (keys.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'key_components are only used with key_definition=key_components.',
    );
  }
  return { name, rowType, rowKind, access, keyDef, keyKind, keys };
}

/** Builds the DdicTtyp payload (DD40V + DD42V). Exported for unit tests. */
export function buildEccTableTypePayload(args: CreateTableTypeArgs) {
  const n = normalizeTableTypeArgs(args);
  const dd40v: Record<string, string> = {
    TYPENAME: n.name,
    DDLANGUAGE: 'E',
    ROWTYPE: n.rowType,
    ROWKIND: ROW_KIND[n.rowKind],
    ACCESSMODE: ACCESS[n.access],
    KEYDEF: KEY_DEF[n.keyDef],
    KEYKIND: KEY_KIND[n.keyKind],
    DDTEXT: (args.description || n.name).slice(0, 60),
  };
  if (n.keys.length > 0)
    dd40v.KEYFDCOUNT = String(n.keys.length).padStart(4, '0');
  const dd42v = n.keys.map((k, i) => ({
    TYPENAME: n.name,
    KEYFDPOS: String(i + 1).padStart(4, '0'),
    KEYFIELD: k,
  }));
  return { dd40v, dd42v };
}

export async function handleCreateTableType(
  context: HandlerContext,
  args: CreateTableTypeArgs,
): Promise<any> {
  const { connection, logger } = context;
  try {
    if (!args?.package_name) {
      throw new McpError(ErrorCode.InvalidParams, 'package_name is required');
    }
    const n = normalizeTableTypeArgs(args);
    const shouldActivate = args.activate !== false;
    if (args.package_name.toUpperCase() !== '$TMP' && !args.transport_request) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Package ${args.package_name} is transportable — pass transport_request.`,
      );
    }

    if (process.env.SAP_VERSION?.toUpperCase() === 'ECC') {
      const payload = buildEccTableTypePayload(args);
      logger?.info(`ECC: creating table type ${n.name} via ZMCP_ADT_DDIC_TTYP`);
      await callDdicTtyp(connection, 'CREATE', {
        name: n.name,
        devclass: args.package_name,
        transport: args.transport_request,
        payload_json: JSON.stringify(payload),
      });
      let warn = '';
      if (shouldActivate) {
        const act = await callDdicActivate(connection, 'TTYP', n.name);
        if (act.subrc !== 0)
          warn = ` (activation rc=${act.subrc}: ${act.message})`;
      }
      return return_response({
        data: JSON.stringify(
          {
            success: true,
            table_type_name: n.name,
            package: args.package_name,
            transport_request: args.transport_request || null,
            row_type: n.rowType,
            status: shouldActivate ? 'active' : 'inactive',
            message: `Table type ${n.name} created${shouldActivate ? ` and activated${warn}` : ' (inactive)'} (ECC fallback via ${eccBridgeVia()})`,
            path: eccBridgePath(),
          },
          null,
          2,
        ),
      } as AxiosResponse);
    }

    if (n.keyDef === 'key_components') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'key_components are not supported on the ADT path yet. Use key_definition standard / row_type, then set the key in SE11.',
      );
    }
    const client = createAdtClient(connection, logger);
    const tableType = client.getTableType();
    const config = {
      tableTypeName: n.name,
      packageName: args.package_name,
      transportRequest: args.transport_request,
      description: args.description || n.name,
      rowTypeName: n.rowType,
      rowTypeKind: 'dictionaryType' as const,
      accessType: (n.access === 'any' ? 'notSpecified' : n.access) as
        | 'standard'
        | 'sorted'
        | 'hashed'
        | 'index'
        | 'notSpecified',
      primaryKeyDefinition: (
        {
          standard: 'standard',
          row_type: 'rowType',
          none: 'notSpecified',
        } as const
      )[n.keyDef as 'standard' | 'row_type' | 'none'],
      primaryKeyKind: (
        {
          non_unique: 'nonUnique',
          unique: 'unique',
          not_specified: 'notSpecified',
        } as const
      )[n.keyKind],
    };
    logger?.info(`Creating table type ${n.name} via ADT`);
    await tableType.create(config);
    await tableType.update(config, { activateOnUpdate: shouldActivate });

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          table_type_name: n.name,
          package: args.package_name,
          transport_request: args.transport_request || null,
          row_type: n.rowType,
          status: shouldActivate ? 'active' : 'inactive',
          message: `Table type ${n.name} created${shouldActivate ? ' and activated' : ' (inactive)'}`,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    logger?.error(`CreateTableType error: ${error?.message || error}`);
    return return_error(
      new Error(
        `Failed to create table type ${args?.table_type_name}: ${error?.message || String(error)}`,
      ),
    );
  }
}
