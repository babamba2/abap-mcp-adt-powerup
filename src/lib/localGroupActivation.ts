/**
 * Local mass-activation helper.
 *
 * Why this exists
 * ---------------
 * adt-clients v3.10.2 exposes `AdtUtils.activateObjectsGroup(objects, preaudit)`
 * which POSTs to `/sap/bc/adt/activation/runs` and long-polls for results.
 * However its wrapper:
 *   1. Calls upstream `buildObjectUri(name, type)` internally — which has no
 *      `PROG/I` mapping (and silently builds `/sap/bc/adt/prog/i/{name}`).
 *   2. Accepts no caller-supplied explicit URI, so we can't override.
 *   3. Throws a generic "Failed to extract activation run ID" error on
 *      legacy NetWeaver < 7.50 where `/runs` is not available, hiding the
 *      need to fall back to the sync `/sap/bc/adt/activation` endpoint.
 *
 * `activateObjectsLocal()` below mirrors the upstream flow but uses
 * `resolveAdtUri` (which accepts explicit URIs and covers PROG/I + friends)
 * and falls back to the sync single-POST endpoint when the async run flow
 * is unavailable. It also returns a parsed per-object result list instead
 * of an opaque AxiosResponse.
 */

import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { XMLParser } from 'fast-xml-parser';
import { createAdtClient } from './clients';
import { resolveAdtUri } from './resolveAdtUri';
import { makeAdtRequestWithTimeout } from './utils';

export interface ActivationObjectInput {
  name: string;
  type: string;
  uri?: string;
  parent_name?: string;
}

export interface ActivationMessage {
  type: string; // 'E' | 'W' | 'I'
  text: string;
  line?: string | number;
  column?: string | number;
  href?: string;
  objectName?: string;
  objectUri?: string;
}

export interface ActivationObjectResult {
  name: string;
  type: string;
  uri: string;
  status: 'activated' | 'failed';
  errors: ActivationMessage[];
  warnings: ActivationMessage[];
}

export interface GroupActivationResult {
  endpoint: 'runs' | 'sync';
  success: boolean;
  activated: boolean;
  checked: boolean;
  generated: boolean;
  run_id?: string;
  objects: ActivationObjectResult[];
  errors: ActivationMessage[];
  warnings: ActivationMessage[];
  /** Set when SAP sent no message document and the result was inferred. */
  notes?: string[];
  raw_response?: string;
}

const ACTIVATION_CT =
  'application/vnd.sap.adt.activation.request+xml; charset=utf-8';

function buildObjectReferencesXml(
  entries: Array<{ uri: string; name: string; type?: string }>,
): string {
  const refs = entries
    .map(
      (e) =>
        `  <adtcore:objectReference adtcore:uri="${e.uri}"${
          e.type ? ` adtcore:type="${e.type}"` : ''
        } adtcore:name="${e.name}"/>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${refs}
</adtcore:objectReferences>`;
}

function extractRunId(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.match(/\/activation\/runs\/([^/?#]+)/);
  return match ? match[1] : null;
}

function headerToString(
  value: string | string[] | number | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value))
    return value.length > 0 ? String(value[0]) : undefined;
  return String(value);
}

/**
 * Long-poll the activation run endpoint until it finishes or times out.
 */
async function waitForRun(
  connection: IAbapConnection,
  runId: string,
  maxWaitMs: number,
  pollMs: number,
): Promise<void> {
  const url = `/sap/bc/adt/activation/runs/${runId}?withLongPolling=true`;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const resp = await makeAdtRequestWithTimeout(
      connection,
      url,
      'GET',
      'default',
      undefined,
      undefined,
      {
        Accept: 'application/xml, application/vnd.sap.adt.backgroundrun.v1+xml',
      },
    );
    const parsed = parser.parse(resp.data);
    const run = parsed?.run;
    if (!run) {
      throw new Error(
        'Invalid activation run response — missing <run> element',
      );
    }
    const status = run['@_status'];
    if (status === 'finished') return;
    if (status === 'error' || status === 'failed') {
      throw new Error(
        `Activation run ${runId} terminated with status ${status}`,
      );
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Activation run ${runId} did not finish within ${maxWaitMs}ms`,
  );
}

/**
 * True when the activation response carries no document at all. BASIS 7.40
 * answers a successful sync activation (POST /sap/bc/adt/activation) with
 * HTTP 200 and an empty body — no <chkl:messages>, no properties.
 */
export function isEmptyActivationBody(body: unknown): boolean {
  if (body === undefined || body === null) return true;
  return (
    String(body)
      .replace(/^\uFEFF/, '')
      .trim() === ''
  );
}

/**
 * Parse `<chkl:messages>` + per-object markup from an activation response
 * into structured per-object results. Handles both the run-results shape
 * (`/sap/bc/adt/activation/results/{id}`) and the sync shape
 * (`/sap/bc/adt/activation`), which differ slightly.
 */
export function parseActivationResults(
  xmlBody: string,
  inputObjects: Array<{ name: string; type: string; uri: string }>,
): {
  activated: boolean;
  checked: boolean;
  generated: boolean;
  objects: ActivationObjectResult[];
  errors: ActivationMessage[];
  warnings: ActivationMessage[];
  emptyResponse: boolean;
} {
  if (isEmptyActivationBody(xmlBody)) {
    // HTTP 200 without a message document = no errors, no warnings (7.40).
    // Callers should confirm against the inactive-objects list.
    return {
      activated: true,
      checked: true,
      generated: true,
      objects: inputObjects.map((obj) => ({
        name: obj.name,
        type: obj.type,
        uri: obj.uri,
        status: 'activated' as const,
        errors: [],
        warnings: [],
      })),
      errors: [],
      warnings: [],
      emptyResponse: true,
    };
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xmlBody ?? '');
  const root = parsed?.messages ?? parsed ?? {};
  const props = root.properties ?? {};
  const activated =
    props['@_activationExecuted'] === 'true' ||
    props['@_activationExecuted'] === true;
  const checked =
    props['@_checkExecuted'] === 'true' || props['@_checkExecuted'] === true;
  const generated =
    props['@_generationExecuted'] === 'true' ||
    props['@_generationExecuted'] === true;

  const rawMessages = root.msg;
  const msgArray = Array.isArray(rawMessages)
    ? rawMessages
    : rawMessages
      ? [rawMessages]
      : [];

  const allErrors: ActivationMessage[] = [];
  const allWarnings: ActivationMessage[] = [];

  // Attach messages to objects by URI match when SAP includes an href
  // pointing back at the object. Fallback: add to the group-level bucket.
  const perObjectErrors = new Map<string, ActivationMessage[]>();
  const perObjectWarnings = new Map<string, ActivationMessage[]>();
  for (const obj of inputObjects) {
    perObjectErrors.set(obj.uri, []);
    perObjectWarnings.set(obj.uri, []);
  }

  for (const raw of msgArray) {
    if (!raw || typeof raw !== 'object') continue;
    const rawLine = raw['@_line'] ?? raw.line;
    const href = raw['@_href'] ?? raw.href;
    let line: string | number | undefined = rawLine;
    // SAP often emits line="1" and encodes the real line/column inside the
    // href fragment: `#start=line,col;end=line,col`.
    if (typeof href === 'string') {
      const m = href.match(/#start=(\d+),(\d+)?/);
      if (m) line = m[1];
    }
    const shortText =
      (raw.shortText &&
        (raw.shortText['#text'] ?? raw.shortText.txt ?? raw.shortText)) ??
      raw['@_shortText'] ??
      '';
    const type = String(raw['@_type'] ?? raw.type ?? '').toUpperCase();
    const message: ActivationMessage = {
      type,
      text: String(shortText),
      line,
      href: typeof href === 'string' ? href : undefined,
    };

    // Best-effort: locate which input object this message belongs to by
    // checking which input URI appears as a prefix of the href.
    if (typeof href === 'string') {
      const owner = inputObjects.find(
        (o) => href.startsWith(o.uri) || href.includes(o.uri),
      );
      if (owner) {
        message.objectUri = owner.uri;
        message.objectName = owner.name;
      }
    }

    if (type === 'E' || type === 'A' || type === 'X') {
      allErrors.push(message);
      const bucket = message.objectUri
        ? perObjectErrors.get(message.objectUri)
        : undefined;
      bucket?.push(message);
    } else if (type === 'W') {
      allWarnings.push(message);
      const bucket = message.objectUri
        ? perObjectWarnings.get(message.objectUri)
        : undefined;
      bucket?.push(message);
    }
  }

  const perObject: ActivationObjectResult[] = inputObjects.map((obj) => {
    const errs = perObjectErrors.get(obj.uri) ?? [];
    const wrns = perObjectWarnings.get(obj.uri) ?? [];
    return {
      name: obj.name,
      type: obj.type,
      uri: obj.uri,
      status: errs.length === 0 && activated ? 'activated' : 'failed',
      errors: errs,
      warnings: wrns,
    };
  });

  return {
    activated,
    checked,
    generated,
    objects: perObject,
    errors: allErrors,
    warnings: allWarnings,
    emptyResponse: false,
  };
}

const norm = (v: string | undefined) => (v ?? '').toLowerCase();

/**
 * After an empty activation response, mark every requested object that is
 * still in GET /sap/bc/adt/activation/inactiveobjects as failed. If the list
 * cannot be read, the inferred result is kept and a note says so.
 */
export function applyInactiveCheck(
  parsed: ReturnType<typeof parseActivationResults>,
  stillInactive: Array<{ name: string; type?: string; uri?: string }> | null,
): { parsed: ReturnType<typeof parseActivationResults>; notes: string[] } {
  const notes: string[] = [
    'SAP returned an empty activation response (BASIS 7.40 style: no messages). Result inferred from HTTP 200.',
  ];
  if (!stillInactive) {
    notes.push(
      'Could not read /sap/bc/adt/activation/inactiveobjects to confirm; verify with GetInactiveObjects.',
    );
    return { parsed, notes };
  }
  notes.push('Confirmed against /sap/bc/adt/activation/inactiveobjects.');
  const errors = [...parsed.errors];
  const objects = parsed.objects.map((obj) => {
    const hit = stillInactive.find(
      (i) =>
        (i.uri &&
          norm(i.uri.split(/[?#]/)[0]) === norm(obj.uri.split(/[?#]/)[0])) ||
        (norm(i.name) === norm(obj.name) &&
          (!obj.type || !i.type || norm(i.type) === norm(obj.type))),
    );
    if (!hit) return obj;
    const msg: ActivationMessage = {
      type: 'E',
      text: `${obj.name} is still inactive after activation (SAP sent no messages). Run a syntax check (GetAbapSemanticAnalysis) or activate it in SE80 to see the reason.`,
      objectName: obj.name,
      objectUri: obj.uri,
    };
    errors.push(msg);
    return { ...obj, status: 'failed' as const, errors: [...obj.errors, msg] };
  });
  return { parsed: { ...parsed, objects, errors }, notes };
}

async function readInactiveList(
  connection: IAbapConnection,
): Promise<Array<{ name: string; type?: string; uri?: string }> | null> {
  try {
    const res = await createAdtClient(connection)
      .getUtils()
      .getInactiveObjects();
    return (res?.objects ?? []) as Array<{
      name: string;
      type?: string;
      uri?: string;
    }>;
  } catch {
    return null;
  }
}

export interface LocalGroupActivationOptions {
  preauditRequested?: boolean;
  /** Max wait for run to finish, in ms. Default 120000 (2 minutes). */
  runTimeoutMs?: number;
  /** Polling interval while waiting for run, ms. Default 1000. */
  pollIntervalMs?: number;
}

/**
 * Activate many ABAP objects in a single request. Attempts the run-based
 * endpoint first and falls back to the sync endpoint on legacy systems.
 */
export async function activateObjectsLocal(
  connection: IAbapConnection,
  objects: ActivationObjectInput[],
  options: LocalGroupActivationOptions = {},
): Promise<GroupActivationResult> {
  if (!objects || objects.length === 0) {
    throw new Error('activateObjectsLocal: objects must be a non-empty array');
  }
  const preauditRequested = options.preauditRequested !== false;
  const runTimeoutMs = options.runTimeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  const resolved = objects.map((obj) => ({
    name: obj.name.toUpperCase(),
    type: obj.type,
    uri: resolveAdtUri({
      name: obj.name,
      type: obj.type,
      uri: obj.uri,
      parentName: obj.parent_name,
    }),
  }));

  const xmlBody = buildObjectReferencesXml(resolved);

  // ── Attempt run-based endpoint first ──────────────────────────────────
  try {
    const startUrl = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;
    const startResp = await makeAdtRequestWithTimeout(
      connection,
      startUrl,
      'POST',
      'long',
      xmlBody,
      undefined,
      {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
      },
    );
    const location =
      headerToString(startResp.headers?.location) ??
      headerToString(startResp.headers?.Location) ??
      headerToString(startResp.headers?.['content-location']) ??
      headerToString(startResp.headers?.['Content-Location']);
    const runId = extractRunId(location);
    if (runId) {
      await waitForRun(connection, runId, runTimeoutMs, pollIntervalMs);
      const resultsResp = await makeAdtRequestWithTimeout(
        connection,
        `/sap/bc/adt/activation/results/${runId}`,
        'GET',
        'default',
        undefined,
        undefined,
        { Accept: 'application/xml' },
      );
      const body =
        typeof resultsResp.data === 'string'
          ? resultsResp.data
          : String(resultsResp.data ?? '');
      let parsed = parseActivationResults(body, resolved);
      let notes: string[] | undefined;
      if (parsed.emptyResponse) {
        const checked = applyInactiveCheck(
          parsed,
          await readInactiveList(connection),
        );
        parsed = checked.parsed;
        notes = checked.notes;
      }
      return {
        endpoint: 'runs',
        success: parsed.activated && parsed.errors.length === 0,
        activated: parsed.activated,
        checked: parsed.checked,
        generated: parsed.generated,
        run_id: runId,
        objects: parsed.objects,
        errors: parsed.errors,
        warnings: parsed.warnings,
        ...(notes ? { notes } : {}),
        raw_response: body,
      };
    }
    // Missing Location header → treat as fallback signal; fall through.
  } catch (runError: any) {
    // Only fall back for "endpoint unavailable" symptoms (404, 501); for any
    // other error (auth, timeout) re-throw so callers see the real cause.
    const status = runError?.response?.status;
    if (status !== 404 && status !== 501) {
      throw runError;
    }
  }

  // ── Sync fallback ─────────────────────────────────────────────────────
  const syncResp = await makeAdtRequestWithTimeout(
    connection,
    `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`,
    'POST',
    'long',
    xmlBody,
    undefined,
    {
      Accept: 'application/xml',
      'Content-Type': ACTIVATION_CT,
    },
  );
  const body =
    typeof syncResp.data === 'string'
      ? syncResp.data
      : String(syncResp.data ?? '');
  let parsed = parseActivationResults(body, resolved);
  let notes: string[] | undefined;
  if (parsed.emptyResponse) {
    const checked = applyInactiveCheck(
      parsed,
      await readInactiveList(connection),
    );
    parsed = checked.parsed;
    notes = checked.notes;
  }
  return {
    endpoint: 'sync',
    success: parsed.activated && parsed.errors.length === 0,
    activated: parsed.activated,
    checked: parsed.checked,
    generated: parsed.generated,
    objects: parsed.objects,
    errors: parsed.errors,
    warnings: parsed.warnings,
    ...(notes ? { notes } : {}),
    raw_response: body,
  };
}
