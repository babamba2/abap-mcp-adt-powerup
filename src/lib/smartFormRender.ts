/**
 * SmartForm output as SAP prints it — the reference picture for a preview.
 *
 * SAP side: ZMCP_ADT_DISPATCH action SSF_RENDER → FM ZMCP_SSF_RENDER, which
 * calls the form's generated function module with the given interface
 * values and CONTROL_PARAMETERS-GETOTF = 'X' (no dialog, no spool) and
 * converts the OTF to PDF. The form's own program lines run, like in a real
 * print. Both files are written under the MCP output directory
 * (smartforms/<form>/<form>.sap.otf.txt and .sap.pdf).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { callDispatch } from './rfcBackend';
import { safeOutputPath } from './sourceOutput';

export const SSF_RENDER_INSTALL_HINT =
  'The SAP side of RenderSmartForm is not installed on this system: it needs FM ZMCP_SSF_RENDER ' +
  '(function group ZMCP_ADT_UTILS) and the SSF_RENDER branch in ZMCP_ADT_DISPATCH. ' +
  'Sources and install steps: sc4sap/abap/README.md (zmcp_ssf_render.abap).';

export interface SmartFormRenderResult {
  form: string;
  fm: string;
  device?: string;
  deviceType?: string;
  pages: number;
  message?: string;
  files: { otf: string; pdf?: string };
}

/** values: interface parameter → value in /UI2/CL_JSON shape (internal formats). */
export async function renderSmartForm(
  connection: IAbapConnection,
  formName: string,
  values: Record<string, unknown>,
  language?: string,
  device?: string,
  families?: string[],
): Promise<SmartFormRenderResult> {
  const params = Object.entries(values ?? {}).map(([name, v]) => ({
    name: name.toUpperCase(),
    json: JSON.stringify(upperKeys(v)),
  }));
  let result: any;
  let message: string | undefined;
  try {
    ({ result, message } = (await callDispatch(connection, 'SSF_RENDER', {
      form_name: formName,
      params: JSON.stringify(params),
      language: language ?? '',
      device: device ?? '',
      families: (families ?? []).join(','),
    })) as any);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      /Unknown action:\s*SSF_RENDER/i.test(msg) ||
      /ZMCP_SSF_RENDER[\s\S]*not found/i.test(msg)
    )
      throw new Error(`${SSF_RENDER_INSTALL_HINT} (SAP said: ${msg})`);
    throw new Error(msg);
  }
  if (!result || typeof result !== 'object' || !result.otf)
    throw new Error(
      `SSF_RENDER returned no OTF: ${String(message ?? JSON.stringify(result)).substring(0, 300)}`,
    );

  const dir = `smartforms/${formName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
  const write = (name: string, data: Buffer) => {
    const abs = safeOutputPath(`${dir}/${name}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
    return abs;
  };
  const base = formName.toLowerCase();
  const files: SmartFormRenderResult['files'] = {
    otf: write(`${base}.sap.otf.txt`, Buffer.from(result.otf, 'base64')),
  };
  if (result.pdf)
    files.pdf = write(`${base}.sap.pdf`, Buffer.from(result.pdf, 'base64'));
  return {
    form: result.form ?? formName,
    fm: result.fm ?? '',
    device: result.device ?? '',
    deviceType: result.deviceType ?? '',
    pages: Number(result.pages ?? 0),
    ...(message ? { message } : {}),
    files,
  };
}

/** /UI2/CL_JSON matches ABAP component names; send them upper case. */
function upperKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(upperKeys);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k.toUpperCase(), upperKeys(x)]),
    );
  return v;
}
