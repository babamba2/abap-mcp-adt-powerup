/**
 * CreateProgram Handler - ABAP Program Creation via ADT API
 *
 * Workflow: validate -> create (object in initial state)
 * Source code is set via UpdateProgram handler.
 */

import type { IAdtResponse } from '@babamba2/mcp-abap-adt-interfaces';
import { createAdtClient } from '../../../lib/clients';
import type { HandlerContext } from '../../../lib/handlers/interfaces';
import {
  assertNoCheckErrors,
  runSyntaxCheck,
} from '../../../lib/preCheckBeforeActivation';
import {
  encodeSapObjectName,
  extractAdtErrorMessage,
  isCloudConnection,
  parseValidationResponse,
  return_error,
  return_response,
} from '../../../lib/utils';
import { validateTransportRequest } from '../../../utils/transportValidation.js';

export const TOOL_DEFINITION = {
  name: 'CreateProgram',
  available_in: ['onprem', 'legacy'] as const,
  description:
    'Create a new ABAP program (report) in SAP system. Creates the program object in initial state. Use UpdateProgram to set source code afterwards.',
  inputSchema: {
    type: 'object',
    properties: {
      program_name: {
        type: 'string',
        description:
          'Program name (e.g., Z_TEST_PROGRAM_001). Must follow SAP naming conventions (start with Z or Y).',
      },
      description: {
        type: 'string',
        description:
          'Program description. If not provided, program_name will be used.',
      },
      package_name: {
        type: 'string',
        description: 'Package name (e.g., ZOK_LAB, $TMP for local objects)',
      },
      transport_request: {
        type: 'string',
        description: 'Transport request. Required for transportable packages.',
      },
      program_type: {
        type: 'string',
        description:
          "Program type: 'executable' (Report), 'include', 'module_pool', 'function_group', 'class_pool', 'interface_pool'. Default: 'executable'",
        enum: [
          'executable',
          'include',
          'module_pool',
          'function_group',
          'class_pool',
          'interface_pool',
        ],
      },
      application: {
        type: 'string',
        description:
          "Application area (e.g., 'S' for System, 'M' for Materials Management). Default: '*'",
      },
    },
    required: ['program_name', 'package_name'],
  },
} as const;

interface CreateProgramArgs {
  program_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  program_type?: string;
  application?: string;
}

export async function handleCreateProgram(
  context: HandlerContext,
  params: any,
) {
  const { connection, logger } = context;
  const args: CreateProgramArgs = params;

  // Validate required parameters
  if (!args.program_name || !args.package_name) {
    return return_error(
      new Error('Missing required parameters: program_name and package_name'),
    );
  }

  // Check if cloud - programs are not available on cloud systems
  if (isCloudConnection()) {
    return return_error(
      new Error(
        'Programs are not available on cloud systems (ABAP Cloud). This operation is only supported on on-premise systems.',
      ),
    );
  }

  // Validate transport_request: required for non-$TMP packages
  try {
    validateTransportRequest(args.package_name, args.transport_request);
  } catch (error) {
    return return_error(error as Error);
  }

  const programName = args.program_name.toUpperCase();
  logger?.info(`Starting program creation: ${programName}`);

  // Which ADT request was running when an error came back.
  let step: 'validate' | 'create' = 'validate';
  try {
    const client = createAdtClient(connection);

    // Validate
    logger?.debug(`Validating program: ${programName}`);
    const validationState = await client.getProgram().validate({
      programName,
      description: args.description || programName,
      packageName: args.package_name,
    });
    const validationResponse = validationState.validationResponse;
    if (!validationResponse) {
      throw new Error('Validation did not return a result');
    }
    const validationResult = parseValidationResponse(
      validationResponse as IAdtResponse,
    );
    if (!validationResult || validationResult.valid === false) {
      throw new Error(
        `Program name validation failed: ${validationResult?.message || 'Invalid program name'}`,
      );
    }
    logger?.debug(`Program validation passed: ${programName}`);

    // Create
    logger?.debug(`Creating program: ${programName}`);
    step = 'create';
    await client.getProgram().create({
      programName,
      description: args.description || programName,
      packageName: args.package_name,
      transportRequest: args.transport_request,
      programType: args.program_type,
      application: args.application,
    });
    logger?.info(`Program created: ${programName}`);

    // Post-create sanity syntax check. The shell the ADT create endpoint
    // produces is a minimal REPORT statement that should always be
    // clean, but the check also verifies the package / transport /
    // naming side of things once the object is actually in the system.
    // Non-fatal: if the check endpoint fails for transport reasons, log
    // a warning and still return success.
    const stepsCompleted = ['validate', 'create'];
    let checkWarnings: Array<{
      type: string;
      text: string;
      line?: string | number;
    }> = [];
    try {
      logger?.debug(`Post-create syntax check: ${programName}`);
      const checkResult = await runSyntaxCheck(
        { connection, logger },
        { kind: 'program', name: programName },
      );
      assertNoCheckErrors(checkResult, 'Program', programName);
      checkWarnings = checkResult.warnings;
      stepsCompleted.push('check');
      logger?.debug(
        `Post-create syntax check passed: ${programName} (${checkWarnings.length} warning${checkWarnings.length === 1 ? '' : 's'})`,
      );
    } catch (checkErr: any) {
      if (checkErr?.isPreCheckFailure) {
        logger?.error(
          `Program ${programName} was created but failed post-create syntax check: ${checkErr.message}`,
        );
        return return_error(checkErr);
      }
      logger?.warn(
        `Post-create check had issues for ${programName}: ${
          checkErr instanceof Error ? checkErr.message : String(checkErr)
        }`,
      );
    }

    const result = {
      success: true,
      program_name: programName,
      package_name: args.package_name,
      transport_request: args.transport_request || null,
      program_type: args.program_type || 'executable',
      type: 'PROG/P',
      message: `Program ${programName} created successfully. Use UpdateProgram to set source code.`,
      uri: `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}`,
      steps_completed: stepsCompleted,
      check_warnings: checkWarnings.length > 0 ? checkWarnings : undefined,
    };

    return return_response({
      data: JSON.stringify(result, null, 2),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  } catch (error: any) {
    const errorMessage = describeCreateError(error, step);
    logger?.error(`Error creating program ${programName}: ${errorMessage}`);
    return return_error(
      new Error(`Failed to create program ${programName}: ${errorMessage}`),
    );
  }
}

/**
 * Error text for a failed CreateProgram request: the ADT step, the HTTP
 * status and SAP's own message (exception XML or body), so a bare
 * "status code 403" no longer hides the reason.
 * @param error error thrown by the ADT client
 * @param step ADT request that was running
 * @returns one-line description
 */
export function describeCreateError(
  error: any,
  step: 'validate' | 'create',
): string {
  const response = error?.response;
  if (!response) {
    // The client library wraps validate 4xx errors ("Validation failed: …")
    // without the HTTP response; keep its text and name the step.
    let plain = error instanceof Error ? error.message : String(error);
    // It may carry the ADT exception XML: keep only SAP's message text.
    const excMsg =
      /<exc:exception[\s\S]*?<message[^>]*>([\s\S]*?)<\/message>/.exec(plain);
    const sapText = excMsg ? decodeXmlEntities(excMsg[1]).trim() : '';
    if (sapText) {
      plain = `${plain.slice(0, plain.indexOf('<')).trim()} SAP Error: ${sapText}`;
    }
    return `[${step}] ${plain.trim().slice(0, 2000)}`;
  }
  const status = response.status;
  let text = extractAdtErrorMessage(error, error?.message || String(error));
  if (/<html[\s>]/i.test(text)) {
    // ICM / web dispatcher error pages: keep the readable text only.
    text = text
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
  const csrf = String(response.headers?.['x-csrf-token'] ?? '');
  if (status === 403 && csrf.toLowerCase() === 'required') {
    text += ' (CSRF token rejected by SAP: x-csrf-token: Required)';
  }
  return `[${step}] HTTP ${status ?? '?'}: ${text}`;
}

/**
 * Decodes the five predefined XML entities and numeric character references.
 * @param s text taken from an XML element
 * @returns decoded text
 */
function decodeXmlEntities(s: string): string {
  const cp = (n: number, raw: string) =>
    Number.isInteger(n) && n >= 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : raw;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (raw, h) => cp(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d) => cp(Number(d), raw))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
