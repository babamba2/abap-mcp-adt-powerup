import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  type AxiosResponse,
  encodeSapObjectName,
  makeAdtRequestWithTimeout,
  return_error,
  return_response,
} from '../../../lib/utils';

export const TOOL_DEFINITION = {
  name: 'ReadProgram',
  available_in: ['onprem', 'legacy'] as const,
  description:
    '[read-only] Read ABAP program or include source code and metadata (package, responsible, description, etc.). The result carries object_type PROG/P or PROG/I; an unknown name returns an error.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description: 'Program name (e.g., Z_MY_PROGRAM).',
      },
      version: {
        type: 'string',
        enum: ['active', 'inactive'],
        description: 'Version to read: "active" (default) or "inactive".',
        default: 'active',
      },
    },
    required: ['program_name'],
  },
} as const;

export async function handleReadProgram(
  context: HandlerContext,
  args: { program_name: string; version?: 'active' | 'inactive' },
) {
  const { connection, logger } = context;
  try {
    const { program_name, version = 'active' } = args;
    if (!program_name)
      return return_error(new Error('program_name is required'));

    const client = createAdtClient(connection, logger);
    const programName = program_name.toUpperCase();
    const obj = client.getProgram();

    let source_code: string | null = null;
    try {
      const readResult = await obj.read(
        { programName },
        version as 'active' | 'inactive',
      );
      if (readResult?.readResult?.data) {
        source_code =
          typeof readResult.readResult.data === 'string'
            ? readResult.readResult.data
            : safeStringify(readResult.readResult.data);
      }
    } catch (e: any) {
      logger?.warn(`Could not read source for ${programName}: ${e?.message}`);
    }

    let metadata: string | null = null;
    try {
      const metaResult = await obj.readMetadata({ programName });
      if (metaResult?.metadataResult?.data) {
        metadata =
          typeof metaResult.metadataResult.data === 'string'
            ? metaResult.metadataResult.data
            : safeStringify(metaResult.metadataResult.data);
      }
    } catch (e: any) {
      logger?.warn(`Could not read metadata for ${programName}: ${e?.message}`);
    }

    // Includes (PROG/I) live under /programs/includes/, so the program reads above
    // both fail for them. Retry there instead of reporting success with null fields.
    let object_type = 'PROG/P';
    if (source_code === null && metadata === null) {
      const base = `/sap/bc/adt/programs/includes/${encodeSapObjectName(programName)}`;
      try {
        const src = await makeAdtRequestWithTimeout(
          connection,
          `${base}/source/main`,
          'GET',
          'default',
          undefined,
          { version },
        );
        source_code =
          typeof src.data === 'string' ? src.data : safeStringify(src.data);
        object_type = 'PROG/I';
      } catch (e: any) {
        logger?.warn(
          `Could not read include source for ${programName}: ${e?.message}`,
        );
      }
      if (object_type === 'PROG/I') {
        try {
          const meta = await makeAdtRequestWithTimeout(
            connection,
            base,
            'GET',
            'default',
          );
          metadata =
            typeof meta.data === 'string'
              ? meta.data
              : safeStringify(meta.data);
        } catch (e: any) {
          logger?.warn(
            `Could not read include metadata for ${programName}: ${e?.message}`,
          );
        }
      }
    }
    if (source_code === null && metadata === null) {
      return return_error(
        new Error(
          `Program or include ${programName} not found (version ${version}).`,
        ),
      );
    }

    return return_response({
      data: JSON.stringify(
        {
          success: true,
          program_name: programName,
          object_type,
          version,
          source_code,
          metadata,
        },
        null,
        2,
      ),
    } as AxiosResponse);
  } catch (error: any) {
    return return_error(error);
  }
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
