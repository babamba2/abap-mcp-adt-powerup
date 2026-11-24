/**
 * The `values_file` of the form render tools (RenderSmartForm, RenderAdobeForm):
 * a JSON file of invented sample values that is sent to SAP whole.
 *
 * The path comes from the model, so it is confined like an output path:
 * - real path (symlinks / junctions resolved) inside the MCP output directory
 *   or, for the sc4sap layout `<cwd>/.sc4sap/work/<alias>/mcp-output`, inside
 *   the profile's work folder `<cwd>/.sc4sap/work/<alias>`;
 * - no UNC / device paths, `.json` files only, nothing that looks like a
 *   secret (env files, profiles, config.json, keychain, token, credential,
 *   secret, password, key files);
 * - at most MAX_VALUES_BYTES;
 * - a parse error never shows the file's content.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { outputRoot } from './sourceOutput';

export const MAX_VALUES_BYTES = 1024 * 1024;

// one message for a missing file and a file outside the allowed folders: the answer must not tell whether
// a file exists somewhere else
const NOT_ALLOWED =
  'values_file: refused — no such .json file inside the MCP output directory or the profile work folder';

const SECRET_SEGMENT =
  /(^|[\\/])(\.env[^\\/]*|[^\\/]*\.env|sap\.env[^\\/]*|profiles?|config\.json|[^\\/]*keychain[^\\/]*|[^\\/]*token[^\\/]*|[^\\/]*credential[^\\/]*|[^\\/]*secret[^\\/]*|[^\\/]*passw[^\\/]*|[^\\/]*\.(pem|key|pfx|p12))([\\/]|$)/i;

/** Folders a values file may live in (real paths of those that exist). */
export function valuesRoots(): string[] {
  const out = outputRoot();
  const roots = [out];
  // sc4sap: <cwd>/.sc4sap/work/<alias>/mcp-output → also <cwd>/.sc4sap/work/<alias>
  const parent = path.dirname(out);
  if (
    path.basename(out) === 'mcp-output' &&
    path.basename(path.dirname(parent)) === 'work' &&
    path.basename(path.dirname(path.dirname(parent))) === '.sc4sap'
  )
    roots.push(parent);
  const real: string[] = [];
  for (const r of roots) {
    try {
      real.push(fs.realpathSync(r));
    } catch {
      /* not created yet: nothing can live in it */
    }
  }
  return real;
}

const inside = (root: string, p: string): boolean => {
  const rel = path.relative(root, p);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

/** Read and parse a values file under the rules above; throws a short error otherwise. */
export function readValuesFile(file: unknown): Record<string, unknown> {
  const p = String(file ?? '').trim();
  if (!p) throw new Error('values_file: empty path');
  if (/^(\\\\|\/\/)/.test(p) || /^\\\\\?\\/.test(p) || /^[a-z]:[^\\/]/i.test(p))
    throw new Error('values_file: UNC and device paths are not allowed');
  if (SECRET_SEGMENT.test(p))
    throw new Error(
      'values_file: refused (the path looks like a secret or profile file)',
    );
  if (path.extname(p).toLowerCase() !== '.json')
    throw new Error('values_file: a .json file is expected');
  const roots = valuesRoots();
  if (!roots.length)
    throw new Error('values_file: the MCP output directory does not exist yet');
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(roots[0], p));
  } catch {
    throw new Error(NOT_ALLOWED);
  }
  if (!roots.some((r) => inside(r, real))) throw new Error(NOT_ALLOWED);
  if (SECRET_SEGMENT.test(real))
    throw new Error(
      'values_file: refused (the path looks like a secret or profile file)',
    );
  const st = fs.statSync(real);
  if (!st.isFile()) throw new Error('values_file: not a file');
  if (st.size > MAX_VALUES_BYTES)
    throw new Error(`values_file: larger than ${MAX_VALUES_BYTES} bytes`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(real, 'utf8'));
  } catch {
    throw new Error('values_file is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(
      'values_file: a JSON object of parameter values is expected',
    );
  return parsed as Record<string, unknown>;
}

export const MAX_FORM_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Read a form input file (an XDP template or an XML data file for RenderAdobeXdp) under the same confinement
 * as values_file: real path inside the MCP output directory or the profile work folder, no UNC / device paths,
 * nothing that looks like a secret, only the given extensions, at most MAX_FORM_INPUT_BYTES. One message for a
 * missing file and a file outside the allowed folders; the content is never echoed.
 */
export function readFormInputFile(
  file: unknown,
  label: string,
  exts: string[],
): Buffer {
  const p = String(file ?? '').trim();
  const notAllowed = `${label}: refused — no such ${exts.join(' / ')} file inside the MCP output directory or the profile work folder`;
  if (!p) throw new Error(`${label}: empty path`);
  if (/^(\\\\|\/\/)/.test(p) || /^\\\\\?\\/.test(p) || /^[a-z]:[^\\/]/i.test(p))
    throw new Error(`${label}: UNC and device paths are not allowed`);
  if (SECRET_SEGMENT.test(p))
    throw new Error(
      `${label}: refused (the path looks like a secret or profile file)`,
    );
  if (!exts.includes(path.extname(p).toLowerCase()))
    throw new Error(`${label}: a ${exts.join(' / ')} file is expected`);
  const roots = valuesRoots();
  if (!roots.length)
    throw new Error(`${label}: the MCP output directory does not exist yet`);
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(roots[0], p));
  } catch {
    throw new Error(notAllowed);
  }
  if (!roots.some((r) => inside(r, real))) throw new Error(notAllowed);
  if (SECRET_SEGMENT.test(real))
    throw new Error(
      `${label}: refused (the path looks like a secret or profile file)`,
    );
  const st = fs.statSync(real);
  if (!st.isFile()) throw new Error(`${label}: not a file`);
  if (st.size > MAX_FORM_INPUT_BYTES)
    throw new Error(`${label}: larger than ${MAX_FORM_INPUT_BYTES} bytes`);
  return fs.readFileSync(real);
}
