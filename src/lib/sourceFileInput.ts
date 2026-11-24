/**
 * `source_file` — patch-mode input for the source-writing tools.
 *
 * Every Create* / Update* tool whose schema has `source_code` also accepts
 * `source_file`: a path to a source file the caller saved with a read tool
 * (`output: "file"`) and then edited locally. The server reads the file and
 * passes its text on as `source_code`, so the model only emits its edit, never
 * the whole source again.
 *
 * The path is confined exactly like `values_file` (readFormInputFile): real
 * path inside the MCP output directory or the profile work folder, no UNC /
 * device paths, nothing that looks like a secret, `.abap` / `.asddls` /
 * `.txt` only, at most MAX_FORM_INPUT_BYTES. The file content is never echoed.
 */
import { readFormInputFile } from './valuesFile';

export const SOURCE_FILE_EXTS = ['.abap', '.asddls', '.asbdef', '.txt'];

const SOURCE_FILE_DESCRIPTION =
  'Patch mode: path of a source file (saved by a read tool with output "file", then edited) to upload instead of source_code. Inside the MCP output directory or the profile work folder; .abap / .asddls / .asbdef / .txt. Give source_code or source_file, not both.';

/** True for a tool that takes its source as `source_code` and writes it to SAP. */
export function takesSourceFile(toolName: string, inputSchema: any): boolean {
  return (
    /^(Create|Update)/.test(toolName) && !!inputSchema?.properties?.source_code
  );
}

/**
 * Schema with `source_file` added and `source_code` no longer required (one of
 * the two is checked at call time). Returns the schema unchanged for other tools.
 */
export function withSourceFileSchema(toolName: string, inputSchema: any): any {
  if (!takesSourceFile(toolName, inputSchema)) return inputSchema;
  return {
    ...inputSchema,
    properties: {
      ...inputSchema.properties,
      source_file: { type: 'string', description: SOURCE_FILE_DESCRIPTION },
    },
    required: (inputSchema.required || []).filter(
      (k: string) => k !== 'source_code',
    ),
  };
}

/**
 * Replace `source_file` by `source_code` (the file's text). Other tools and
 * calls without `source_file` pass through unchanged. Throws a short error
 * when both are given or the file is refused.
 */
export function resolveSourceFileArg(
  toolName: string,
  inputSchema: any,
  args: any,
): any {
  if (!args || typeof args !== 'object' || args.source_file === undefined)
    return args;
  if (!takesSourceFile(toolName, inputSchema))
    throw new Error(`${toolName} does not take source_file`);
  if (typeof args.source_code === 'string' && args.source_code.length)
    throw new Error('give source_code or source_file, not both');
  const buf = readFormInputFile(
    args.source_file,
    'source_file',
    SOURCE_FILE_EXTS,
  );
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const { source_file: _ignored, ...rest } = args;
  return { ...rest, source_code: text };
}
