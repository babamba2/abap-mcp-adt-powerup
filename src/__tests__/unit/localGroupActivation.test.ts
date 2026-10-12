import { createAdtClient } from '../../lib/clients';
import {
  activateObjectsLocal,
  applyInactiveCheck,
  isEmptyActivationBody,
  parseActivationResults,
} from '../../lib/localGroupActivation';
import { parseActivationResponse } from '../../lib/utils';

jest.mock('../../lib/clients', () => ({
  createAdtClient: jest.fn(),
}));

// Minimal response shape from /sap/bc/adt/activation/results/{id}.
// Two objects: one include that activated cleanly, one with an error pointing
// at its href (line + col encoded in the fragment).
const multiObjectXml = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true" generationExecuted="true"/>
  <chkl:msg type="E" line="1" href="/sap/bc/adt/programs/includes/zmcp_inc02#start=17,10;end=17,20">
    <chkl:shortText>
      <chkl:txt>Statement is not defined. Please check your spelling.</chkl:txt>
    </chkl:shortText>
  </chkl:msg>
  <chkl:msg type="W" href="/sap/bc/adt/programs/includes/zmcp_inc01#start=3,1">
    <chkl:shortText>
      <chkl:txt>Obsolete statement</chkl:txt>
    </chkl:shortText>
  </chkl:msg>
</chkl:messages>`;

const cleanXml = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true" generationExecuted="true"/>
</chkl:messages>`;

const inputs = [
  {
    name: 'ZMCP_INC01',
    type: 'PROG/I',
    uri: '/sap/bc/adt/programs/includes/zmcp_inc01',
  },
  {
    name: 'ZMCP_INC02',
    type: 'PROG/I',
    uri: '/sap/bc/adt/programs/includes/zmcp_inc02',
  },
];

describe('parseActivationResults', () => {
  it('marks all objects activated when the response carries no errors', () => {
    const result = parseActivationResults(cleanXml, inputs);
    expect(result.activated).toBe(true);
    expect(result.checked).toBe(true);
    expect(result.generated).toBe(true);
    expect(result.errors).toEqual([]);
    for (const o of result.objects) {
      expect(o.status).toBe('activated');
    }
  });

  it('attributes messages to the right object by href prefix match', () => {
    const result = parseActivationResults(multiObjectXml, inputs);
    const inc1 = result.objects.find((o) => o.name === 'ZMCP_INC01')!;
    const inc2 = result.objects.find((o) => o.name === 'ZMCP_INC02')!;
    expect(inc1.errors).toHaveLength(0);
    expect(inc1.warnings).toHaveLength(1);
    expect(inc1.warnings[0].line).toBe('3');
    expect(inc1.status).toBe('activated');
    expect(inc2.errors).toHaveLength(1);
    expect(inc2.errors[0].line).toBe('17');
    expect(inc2.errors[0].text).toMatch(/Statement is not defined/);
    expect(inc2.status).toBe('failed');
  });

  it('aggregates errors + warnings at the group level', () => {
    const result = parseActivationResults(multiObjectXml, inputs);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('survives empty input (no entries)', () => {
    const result = parseActivationResults('<chkl:messages/>', inputs);
    expect(result.activated).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.objects).toHaveLength(2);
    // Neither activated nor errored → status defaults to "failed" (not activated)
    for (const o of result.objects) {
      expect(o.status).toBe('failed');
    }
  });
});

// ── BASIS 7.40: sync activation answers HTTP 200 with an EMPTY body ──────
// Captured on a 7.40 SP33 system (activation of an already-active include).
// The /runs endpoint answers 404 "No suitable resource found" there.

describe('BASIS 7.40 empty activation response', () => {
  it('detects empty bodies', () => {
    expect(isEmptyActivationBody('')).toBe(true);
    expect(isEmptyActivationBody('  \r\n')).toBe(true);
    expect(isEmptyActivationBody(undefined)).toBe(true);
    expect(isEmptyActivationBody(cleanXml)).toBe(false);
  });

  it('parseActivationResults treats an empty body as activated without messages', () => {
    const result = parseActivationResults('', inputs);
    expect(result.emptyResponse).toBe(true);
    expect(result.activated).toBe(true);
    expect(result.errors).toEqual([]);
    for (const o of result.objects) expect(o.status).toBe('activated');
  });

  it('applyInactiveCheck fails only the objects still listed as inactive', () => {
    const parsed = parseActivationResults('', inputs);
    const { parsed: checked, notes } = applyInactiveCheck(parsed, [
      // 7.40 list entries carry uri/type/name
      {
        name: 'ZMCP_INC02',
        type: 'PROG/I',
        uri: '/sap/bc/adt/programs/includes/zmcp_inc02',
      },
      {
        name: 'ZMCP_OTHER',
        type: 'PROG/P',
        uri: '/sap/bc/adt/programs/programs/zmcp_other',
      },
    ]);
    expect(checked.objects.find((o) => o.name === 'ZMCP_INC01')!.status).toBe(
      'activated',
    );
    const inc2 = checked.objects.find((o) => o.name === 'ZMCP_INC02')!;
    expect(inc2.status).toBe('failed');
    expect(inc2.errors[0].text).toMatch(/still inactive/);
    expect(checked.errors).toHaveLength(1);
    expect(notes.join(' ')).toMatch(/Confirmed/);
  });

  it('applyInactiveCheck keeps the inferred result when the list is unreadable', () => {
    const parsed = parseActivationResults('', inputs);
    const { parsed: checked, notes } = applyInactiveCheck(parsed, null);
    expect(checked.errors).toEqual([]);
    expect(notes.join(' ')).toMatch(/Could not read/);
  });

  it('parseActivationResponse (per-type low handlers) treats empty as success', () => {
    const r = parseActivationResponse('');
    expect(r.activated).toBe(true);
    expect(r.checked).toBe(true);
    expect(r.messages).toEqual([]);
  });

  it('parseActivationResponse still reads the chkl:messages shape', () => {
    const r = parseActivationResponse(cleanXml);
    expect(r.activated).toBe(true);
    const bad = parseActivationResponse(
      cleanXml.replace(
        'activationExecuted="true"',
        'activationExecuted="false"',
      ),
    );
    expect(bad.activated).toBe(false);
  });

  function mockConnection(syncBody: string) {
    const calls: string[] = [];
    const connection = {
      makeAdtRequest: jest.fn(async (opts: any) => {
        calls.push(`${opts.method} ${opts.url}`);
        if (opts.url.includes('/activation/runs')) {
          const err: any = new Error('Request failed with status code 404');
          err.response = { status: 404, data: 'No suitable resource found' };
          throw err;
        }
        return { status: 200, data: syncBody, headers: {} };
      }),
    };
    return { connection: connection as any, calls };
  }

  it('activateObjectsLocal: 404 on /runs, empty sync body, nothing left inactive → success', async () => {
    (createAdtClient as jest.Mock).mockReturnValue({
      getUtils: () => ({ getInactiveObjects: async () => ({ objects: [] }) }),
    });
    const { connection, calls } = mockConnection('');
    const r = await activateObjectsLocal(connection, [
      { name: 'zmcp_inc01', type: 'PROG/I' },
    ]);
    expect(calls[0]).toMatch(/^POST \/sap\/bc\/adt\/activation\/runs/);
    expect(calls[1]).toMatch(
      /^POST \/sap\/bc\/adt\/activation\?method=activate/,
    );
    expect(r.endpoint).toBe('sync');
    expect(r.success).toBe(true);
    expect(r.objects[0].status).toBe('activated');
    expect(r.notes?.length).toBeGreaterThan(0);
  });

  it('activateObjectsLocal: empty sync body but object still inactive → failed with a reason', async () => {
    (createAdtClient as jest.Mock).mockReturnValue({
      getUtils: () => ({
        getInactiveObjects: async () => ({
          objects: [
            {
              name: 'ZMCP_INC01',
              type: 'PROG/I',
              uri: '/sap/bc/adt/programs/includes/zmcp_inc01',
            },
          ],
        }),
      }),
    });
    const { connection } = mockConnection('');
    const r = await activateObjectsLocal(connection, [
      { name: 'ZMCP_INC01', type: 'PROG/I' },
    ]);
    expect(r.success).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.objects[0].status).toBe('failed');
  });

  it('activateObjectsLocal: non-empty sync body is parsed as before (no inactive lookup)', async () => {
    const getInactiveObjects = jest.fn();
    (createAdtClient as jest.Mock).mockReturnValue({
      getUtils: () => ({ getInactiveObjects }),
    });
    const { connection } = mockConnection(multiObjectXml);
    const r = await activateObjectsLocal(
      connection,
      inputs.map((i) => ({ name: i.name, type: i.type, uri: i.uri })),
    );
    expect(getInactiveObjects).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.notes).toBeUndefined();
  });
});
