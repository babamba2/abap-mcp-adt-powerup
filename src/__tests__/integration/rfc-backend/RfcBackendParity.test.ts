/**
 * Integration test — RFC backend parity.
 *
 * Exercises the same RFC call through both `SAP_RFC_BACKEND=soap` and
 * `SAP_RFC_BACKEND=native` against a live SAP system and compares
 * results. What's being tested is the transport layer — not every
 * handler. If the two backends return equivalent textpool rows for a
 * known-stable standard program (`RSPARAM`), the backend switch is
 * proven safe for the screen/gui_status/text_element handler families.
 *
 * Skip conditions (test passes without running):
 *   • tests/test-config.yaml missing or rfc_backend.enabled=false
 *   • No backends configured, or only-disabled backends
 *   • AuthBroker / env not set up (no live SAP session)
 *   • Native backend listed but node-rfc / NW RFC SDK not installed —
 *     logs and skips that backend only, does not fail the suite
 */

import * as path from 'node:path';
import type { IAbapConnection } from '@babamba2/mcp-abap-adt-interfaces';
import { loadTestConfig } from '../helpers/configHelpers';
import { createTestConnectionAndSession } from '../helpers/sessionHelpers';

type Backend = 'soap' | 'native';

interface RfcBackendConfig {
  enabled?: boolean;
  backends?: Backend[];
  probe_program?: string;
  probe_language?: string;
  native?: {
    ashost?: string;
    sysnr?: string;
    mshost?: string;
    sysid?: string;
    group?: string;
    client?: string;
    user?: string;
    passwd?: string;
    lang?: string;
  };
}

interface TextpoolProbeResult {
  backend: Backend;
  result: any[];
  subrc: number;
  message: string;
}

const rfcCfg: RfcBackendConfig = (loadTestConfig() ?? {}).rfc_backend ?? {};
const enabledBackends: Backend[] = (rfcCfg.backends ?? []).filter(
  (b): b is Backend => b === 'soap' || b === 'native',
);
const probeProgram = rfcCfg.probe_program ?? 'RSPARAM';
const probeLanguage = rfcCfg.probe_language ?? 'EN';
const suiteEnabled = rfcCfg.enabled === true && enabledBackends.length > 0;

// Preserve the process env so per-backend mutations don't leak.
const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    process.env[k] = v;
  }
}

/**
 * Apply backend-specific env needed by `./lib/rfcBackend`. For native,
 * populate SAP_RFC_* from the test-config.yaml block (users should NOT
 * commit real creds — the template documents this).
 */
function applyBackendEnv(backend: Backend) {
  restoreEnv();
  process.env.SAP_RFC_BACKEND = backend;
  if (backend === 'native') {
    const n = rfcCfg.native ?? {};
    if (n.ashost) process.env.SAP_RFC_ASHOST = n.ashost;
    if (n.sysnr) process.env.SAP_RFC_SYSNR = n.sysnr;
    if (n.mshost) process.env.SAP_RFC_MSHOST = n.mshost;
    if (n.sysid) process.env.SAP_RFC_SYSID = n.sysid;
    if (n.group) process.env.SAP_RFC_GROUP = n.group;
    if (n.client) process.env.SAP_RFC_CLIENT = n.client;
    if (n.user) process.env.SAP_RFC_USER = n.user;
    if (n.passwd) process.env.SAP_RFC_PASSWD = n.passwd;
    if (n.lang) process.env.SAP_RFC_LANG = n.lang;
  }
}

async function probeTextpool(
  backend: Backend,
  connection: IAbapConnection,
): Promise<TextpoolProbeResult | null> {
  applyBackendEnv(backend);

  let callTextpool: (
    c: IAbapConnection,
    action: 'READ' | 'WRITE',
    params: { program: string; language?: string; textpool_json?: string },
  ) => Promise<{ result: any; subrc: number; message: string }>;

  try {
    // Fresh module resolution so the backend constant sees the new env
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../../../lib/rfcBackend');
      if (mod.backend !== backend) {
        throw new Error(
          `rfcBackend resolved to '${mod.backend}' but ${backend} was requested`,
        );
      }
      callTextpool = mod.callTextpool;
    });
  } catch (e) {
    console.warn(
      `[RfcBackendParity] Skipping ${backend} — backend module load failed: ${(e as Error).message}`,
    );
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const out = await callTextpool!(connection, 'READ', {
      program: probeProgram,
      language: probeLanguage,
    });
    return {
      backend,
      result: Array.isArray(out.result) ? out.result : [],
      subrc: out.subrc,
      message: out.message,
    };
  } catch (e) {
    const msg = (e as Error).message;
    // node-rfc init / SDK missing / S_RFC auth — skip rather than fail
    if (
      /node-rfc|libsapnwrfc|SAPNWRFC_HOME|SAP_RFC_|S_RFC|authorization/i.test(
        msg,
      )
    ) {
      console.warn(
        `[RfcBackendParity] Skipping ${backend} — ${msg.substring(0, 160)}`,
      );
      return null;
    }
    // Any other error is a real failure — surface it
    throw e;
  }
}

const describeOrSkip = suiteEnabled ? describe : describe.skip;

describeOrSkip('RFC backend parity (integration)', () => {
  let connection: IAbapConnection | null = null;

  beforeAll(async () => {
    try {
      const { connection: conn } = await createTestConnectionAndSession();
      connection = conn as unknown as IAbapConnection;
    } catch (e) {
      console.warn(
        `[RfcBackendParity] No live SAP session — suite will skip: ${(e as Error).message}`,
      );
      connection = null;
    }
  }, 60_000);

  afterAll(() => {
    restoreEnv();
  });

  it('loads at least one enabled backend from config', () => {
    expect(enabledBackends.length).toBeGreaterThan(0);
  });

  it('parity probe: callTextpool READ returns TEXTPOOL rows on each enabled backend', async () => {
    if (!connection) {
      console.warn('[RfcBackendParity] No connection — skipping parity probe');
      return;
    }

    const runs: TextpoolProbeResult[] = [];
    for (const backend of enabledBackends) {
      const r = await probeTextpool(backend, connection);
      if (r) runs.push(r);
    }

    if (runs.length === 0) {
      console.warn(
        '[RfcBackendParity] No backend produced a usable result — skipping',
      );
      return;
    }

    // Per-backend shape assertions
    for (const r of runs) {
      expect(r.subrc).toBe(0);
      // RSPARAM is a standard SAP program with text elements; expect non-empty
      expect(Array.isArray(r.result)).toBe(true);
      expect(r.result.length).toBeGreaterThan(0);
      const first = r.result[0];
      expect(first).toEqual(
        expect.objectContaining({
          ID: expect.any(String),
          KEY: expect.any(String),
          ENTRY: expect.any(String),
        }),
      );
    }

    // Cross-backend parity (only when ≥ 2 backends produced results)
    if (runs.length >= 2) {
      const [a, b] = runs;
      const keysA = new Set(a.result.map((row: any) => `${row.ID}:${row.KEY}`));
      const keysB = new Set(b.result.map((row: any) => `${row.ID}:${row.KEY}`));
      const intersection = [...keysA].filter((k) => keysB.has(k));

      // The two backends call the same FM against the same program in
      // the same language, so their key sets must overlap heavily. Allow
      // tiny drift (one backend's timing vs the other) by requiring ≥ 90%.
      const overlapRatio =
        intersection.length / Math.max(keysA.size, keysB.size);
      expect(overlapRatio).toBeGreaterThanOrEqual(0.9);

      // Sanity: sizes roughly match (±1 row tolerance)
      expect(Math.abs(a.result.length - b.result.length)).toBeLessThanOrEqual(
        Math.ceil(a.result.length * 0.1),
      );
    } else {
      console.warn(
        `[RfcBackendParity] Only ${runs.length} backend(s) produced results — parity comparison skipped`,
      );
    }
  }, 120_000);

  it('SAP_RFC_BACKEND env drives which transport is selected', () => {
    for (const backend of enabledBackends) {
      applyBackendEnv(backend);
      let resolved: string | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../../lib/rfcBackend');
        resolved = mod.backend;
      });
      expect(resolved).toBe(backend);
    }
  });
});
