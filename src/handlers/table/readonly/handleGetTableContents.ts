import * as z from 'zod';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  activeProfile,
  checkTables,
  evaluateHits,
} from '../../../lib/policy/tableBlocklist';
import { ErrorCode, McpError } from '../../../lib/utils';
import {
  parseSqlQueryXml,
  type SqlQueryResponse,
} from '../../system/readonly/handleGetSqlQuery';

const DEFAULT_MAX_ROWS = 20;

export const TOOL_DEFINITION = {
  name: 'GetTableContents',
  available_in: ['onprem', 'cloud'] as const,
  description:
    '[read-only] Retrieve contents (data preview) of an ABAP database table or CDS view, like SE16. Compact by default: column names only, empty cell values left out of each row, 20 rows. Use fields to keep only some columns and include_metadata for column types/descriptions.',
  inputSchema: {
    table_name: z.string().describe('Name of the ABAP table'),
    max_rows: z
      .number()
      .optional()
      .describe(
        `Maximum number of rows to retrieve (default ${DEFAULT_MAX_ROWS})`,
      ),
    fields: z
      .array(z.string())
      .optional()
      .describe(
        'Keep only these columns in the result, e.g. ["MANDT","MTEXT"]. Names are case-insensitive.',
      ),
    include_metadata: z
      .boolean()
      .optional()
      .describe(
        'Return full column metadata (type, length, description) instead of column names only. Default false.',
      ),
    acknowledge_risk: z
      .boolean()
      .optional()
      .describe(
        "Set to true ONLY after the user has explicitly authorized row extraction from an 'ask'-tier protected table. The approval is logged to stderr for audit. Has no effect on 'deny'-tier tables.",
      ),
  },
} as const;

interface CompactOptions {
  fields?: string[];
  includeMetadata?: boolean;
}

/**
 * Shrink a parsed data preview for the model: keep the requested columns,
 * drop empty cells from each row and report column names only unless full
 * metadata was asked for. Every requested column stays listed in `columns`,
 * so a key missing from a row means that cell is empty.
 */
export function compactTableContents(
  tableName: string,
  parsed: SqlQueryResponse,
  opts: CompactOptions = {},
): Record<string, unknown> {
  let columns = parsed.columns;
  let unknownFields: string[] = [];
  if (opts.fields?.length) {
    const wanted = opts.fields.map((f) => f.trim().toUpperCase());
    columns = columns.filter((c) => wanted.includes(c.name.toUpperCase()));
    const known = new Set(columns.map((c) => c.name.toUpperCase()));
    unknownFields = wanted.filter((f) => !known.has(f));
  }

  const rows = parsed.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const v = row[c.name];
      if (v !== null && v !== undefined && v !== '') out[c.name] = v;
    }
    return out;
  });

  const result: Record<string, unknown> = {
    table: tableName,
    rows_returned: rows.length,
  };
  if (parsed.truncated) result.truncated = true;
  if (unknownFields.length) result.unknown_fields = unknownFields;
  result.columns = opts.includeMetadata ? columns : columns.map((c) => c.name);
  result.rows = rows;
  result.note = 'empty cell values are omitted from rows';
  return result;
}

export async function handleGetTableContents(
  context: HandlerContext,
  args: any,
) {
  const { connection, logger } = context;
  try {
    if (!args?.table_name) {
      throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
    }

    const tableName = args.table_name;
    const maxRows = args.max_rows || DEFAULT_MAX_ROWS;

    const hits = checkTables([tableName]);
    const verdict = evaluateHits(
      hits,
      args.acknowledge_risk === true,
      activeProfile(),
    );
    if (verdict.kind === 'deny') {
      logger?.warn(`Blocked GetTableContents: ${tableName}`);
      throw new McpError(ErrorCode.InvalidRequest, verdict.message);
    }
    if (verdict.kind === 'ask') {
      logger?.warn(
        `GetTableContents requires user acknowledgement: ${tableName}`,
      );
      throw new McpError(ErrorCode.InvalidRequest, verdict.message);
    }
    if (verdict.kind === 'approved') {
      process.stderr.write(
        `[mcp-abap-adt][blocklist] AUDIT: user-acknowledged GetTableContents on ${verdict.tables.join(',')}\n`,
      );
      logger?.warn(
        `AUDIT: user-acknowledged GetTableContents on ${verdict.tables.join(',')}`,
      );
    }

    logger?.info(`Reading table contents: ${tableName} (max_rows=${maxRows})`);

    const client = createAdtClient(connection, logger);
    const response = await client
      .getUtils()
      .getTableContents({ table_name: tableName, max_rows: maxRows });

    if (response.status === 200 && response.data) {
      logger?.info('Table contents request completed successfully');

      const parsedData = parseSqlQueryXml(
        response.data,
        `SELECT * FROM ${tableName}`,
        maxRows,
        logger,
      );

      logger?.debug(
        `Parsed table data: rows=${parsedData.rows.length}/${parsedData.total_rows ?? 0}, columns=${parsedData.columns.length}`,
      );

      const compact = compactTableContents(tableName, parsedData, {
        fields: Array.isArray(args.fields) ? args.fields : undefined,
        includeMetadata: args.include_metadata === true,
      });

      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify(compact),
          },
        ],
      };
    } else {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read table contents. Status: ${response.status}`,
      );
    }
  } catch (error) {
    logger?.error('Failed to read table contents', error as any);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ADT error: ${String(error)}`,
        },
      ],
    };
  }
}
