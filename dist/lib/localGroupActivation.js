"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseActivationResults = parseActivationResults;
exports.activateObjectsLocal = activateObjectsLocal;
const fast_xml_parser_1 = require("fast-xml-parser");
const resolveAdtUri_1 = require("./resolveAdtUri");
const utils_1 = require("./utils");
const ACTIVATION_CT = 'application/vnd.sap.adt.activation.request+xml; charset=utf-8';
function buildObjectReferencesXml(entries) {
    const refs = entries
        .map((e) => `  <adtcore:objectReference adtcore:uri="${e.uri}"${e.type ? ` adtcore:type="${e.type}"` : ''} adtcore:name="${e.name}"/>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${refs}
</adtcore:objectReferences>`;
}
function extractRunId(location) {
    if (!location)
        return null;
    const match = location.match(/\/activation\/runs\/([^/?#]+)/);
    return match ? match[1] : null;
}
function headerToString(value) {
    if (value === undefined || value === null)
        return undefined;
    if (Array.isArray(value))
        return value.length > 0 ? String(value[0]) : undefined;
    return String(value);
}
/**
 * Long-poll the activation run endpoint until it finishes or times out.
 */
async function waitForRun(connection, runId, maxWaitMs, pollMs) {
    const url = `/sap/bc/adt/activation/runs/${runId}?withLongPolling=true`;
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
    });
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const resp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, url, 'GET', 'default', undefined, undefined, {
            Accept: 'application/xml, application/vnd.sap.adt.backgroundrun.v1+xml',
        });
        const parsed = parser.parse(resp.data);
        const run = parsed?.run;
        if (!run) {
            throw new Error('Invalid activation run response — missing <run> element');
        }
        const status = run['@_status'];
        if (status === 'finished')
            return;
        if (status === 'error' || status === 'failed') {
            throw new Error(`Activation run ${runId} terminated with status ${status}`);
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Activation run ${runId} did not finish within ${maxWaitMs}ms`);
}
/**
 * Parse `<chkl:messages>` + per-object markup from an activation response
 * into structured per-object results. Handles both the run-results shape
 * (`/sap/bc/adt/activation/results/{id}`) and the sync shape
 * (`/sap/bc/adt/activation`), which differ slightly.
 */
function parseActivationResults(xmlBody, inputObjects) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
    });
    const parsed = parser.parse(xmlBody ?? '');
    const root = parsed?.messages ?? parsed ?? {};
    const props = root.properties ?? {};
    const activated = props['@_activationExecuted'] === 'true' ||
        props['@_activationExecuted'] === true;
    const checked = props['@_checkExecuted'] === 'true' || props['@_checkExecuted'] === true;
    const generated = props['@_generationExecuted'] === 'true' ||
        props['@_generationExecuted'] === true;
    const rawMessages = root.msg;
    const msgArray = Array.isArray(rawMessages)
        ? rawMessages
        : rawMessages
            ? [rawMessages]
            : [];
    const allErrors = [];
    const allWarnings = [];
    // Attach messages to objects by URI match when SAP includes an href
    // pointing back at the object. Fallback: add to the group-level bucket.
    const perObjectErrors = new Map();
    const perObjectWarnings = new Map();
    for (const obj of inputObjects) {
        perObjectErrors.set(obj.uri, []);
        perObjectWarnings.set(obj.uri, []);
    }
    for (const raw of msgArray) {
        if (!raw || typeof raw !== 'object')
            continue;
        const rawLine = raw['@_line'] ?? raw.line;
        const href = raw['@_href'] ?? raw.href;
        let line = rawLine;
        // SAP often emits line="1" and encodes the real line/column inside the
        // href fragment: `#start=line,col;end=line,col`.
        if (typeof href === 'string') {
            const m = href.match(/#start=(\d+),(\d+)?/);
            if (m)
                line = m[1];
        }
        const shortText = (raw.shortText &&
            (raw.shortText['#text'] ?? raw.shortText.txt ?? raw.shortText)) ??
            raw['@_shortText'] ??
            '';
        const type = String(raw['@_type'] ?? raw.type ?? '').toUpperCase();
        const message = {
            type,
            text: String(shortText),
            line,
            href: typeof href === 'string' ? href : undefined,
        };
        // Best-effort: locate which input object this message belongs to by
        // checking which input URI appears as a prefix of the href.
        if (typeof href === 'string') {
            const owner = inputObjects.find((o) => href.startsWith(o.uri) || href.includes(o.uri));
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
        }
        else if (type === 'W') {
            allWarnings.push(message);
            const bucket = message.objectUri
                ? perObjectWarnings.get(message.objectUri)
                : undefined;
            bucket?.push(message);
        }
    }
    const perObject = inputObjects.map((obj) => {
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
    };
}
/**
 * Activate many ABAP objects in a single request. Attempts the run-based
 * endpoint first and falls back to the sync endpoint on legacy systems.
 */
async function activateObjectsLocal(connection, objects, options = {}) {
    if (!objects || objects.length === 0) {
        throw new Error('activateObjectsLocal: objects must be a non-empty array');
    }
    const preauditRequested = options.preauditRequested !== false;
    const runTimeoutMs = options.runTimeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    const resolved = objects.map((obj) => ({
        name: obj.name.toUpperCase(),
        type: obj.type,
        uri: (0, resolveAdtUri_1.resolveAdtUri)({
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
        const startResp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, startUrl, 'POST', 'long', xmlBody, undefined, {
            Accept: 'application/xml',
            'Content-Type': 'application/xml',
        });
        const location = headerToString(startResp.headers?.location) ??
            headerToString(startResp.headers?.Location) ??
            headerToString(startResp.headers?.['content-location']) ??
            headerToString(startResp.headers?.['Content-Location']);
        const runId = extractRunId(location);
        if (runId) {
            await waitForRun(connection, runId, runTimeoutMs, pollIntervalMs);
            const resultsResp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `/sap/bc/adt/activation/results/${runId}`, 'GET', 'default', undefined, undefined, { Accept: 'application/xml' });
            const body = typeof resultsResp.data === 'string'
                ? resultsResp.data
                : String(resultsResp.data ?? '');
            const parsed = parseActivationResults(body, resolved);
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
                raw_response: body,
            };
        }
        // Missing Location header → treat as fallback signal; fall through.
    }
    catch (runError) {
        // Only fall back for "endpoint unavailable" symptoms (404, 501); for any
        // other error (auth, timeout) re-throw so callers see the real cause.
        const status = runError?.response?.status;
        if (status !== 404 && status !== 501) {
            throw runError;
        }
    }
    // ── Sync fallback ─────────────────────────────────────────────────────
    const syncResp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`, 'POST', 'long', xmlBody, undefined, {
        Accept: 'application/xml',
        'Content-Type': ACTIVATION_CT,
    });
    const body = typeof syncResp.data === 'string'
        ? syncResp.data
        : String(syncResp.data ?? '');
    const parsed = parseActivationResults(body, resolved);
    return {
        endpoint: 'sync',
        success: parsed.activated && parsed.errors.length === 0,
        activated: parsed.activated,
        checked: parsed.checked,
        generated: parsed.generated,
        objects: parsed.objects,
        errors: parsed.errors,
        warnings: parsed.warnings,
        raw_response: body,
    };
}
//# sourceMappingURL=localGroupActivation.js.map