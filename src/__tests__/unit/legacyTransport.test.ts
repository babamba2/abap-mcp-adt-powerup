/**
 * Unit tests for GetTransport on BASIS < 7.40: E070 / E07T / E071 read via
 * RFC_READ_TABLE over SOAP RFC. SAP calls are mocked; numbers are invented.
 */

import { handleGetTransport } from '../../handlers/transport/readonly/handleGetTransport';
import { handleListTransports } from '../../handlers/transport/readonly/handleListTransports';
import {
  needsLegacyTransportRead,
  splitOptionLines,
} from '../../lib/legacyTransport';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

function soapTable(rows: string[]): string {
  const items = rows.map((r) => `<item><WA>${r}</WA></item>`).join('');
  return `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><urn:RFC_READ_TABLE.Response xmlns:urn="urn:sap-com:document:sap:rfc:functions"><DATA>${items}</DATA><FIELDS/><OPTIONS/></urn:RFC_READ_TABLE.Response></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

/** Answers each RFC_READ_TABLE call by its QUERY_TABLE. */
function fakeConnection(tables: Record<string, string[]>) {
  return {
    makeAdtRequest: jest.fn(async ({ data }: { data: string }) => {
      const table = /<QUERY_TABLE>(\w+)</.exec(data)?.[1] ?? '';
      return { status: 200, data: soapTable(tables[table] ?? []) };
    }),
  } as any;
}

describe('legacy transport read', () => {
  it('is used only below 7.40', () => {
    process.env.ABAP_RELEASE = '731';
    expect(needsLegacyTransportRead()).toBe(true);
    process.env.ABAP_RELEASE = '740';
    expect(needsLegacyTransportRead()).toBe(false);
    delete process.env.ABAP_RELEASE;
    expect(needsLegacyTransportRead()).toBe(false);
  });

  it('keeps OPTIONS rows within 72 characters', () => {
    const where = Array.from(
      { length: 8 },
      (_, i) => `TRKORR = 'DEVK90000${i}'`,
    ).join(' OR ');
    const lines = splitOptionLines(where);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(72);
    expect(lines.join(' ')).toBe(where);
  });

  it('builds request, tasks and objects from E070 / E07T / E071', async () => {
    process.env.ABAP_RELEASE = '731';
    process.env.SAP_LANGUAGE = 'EN';
    const connection = fakeConnection({
      E070: [
        'DEVK900010          |K|D|           |DEMOUSER    |20261014|082224|',
        'DEVK900011          |S|D|           |DEMOUSER    |20261014|082224|DEVK900010',
      ],
      E07T: [
        'DEVK900010          |E|Demo request | with a bar',
        'DEVK900011          |E|Demo task',
      ],
      E071: [
        'DEVK900011          |000001|R3TR|CLAS|X|ZCL_DEMO',
        'DEVK900011          |000002|LIMU|FUNC| |Z_DEMO_FM',
      ],
    });

    const res: any = await handleGetTransport(
      { connection, logger: undefined } as any,
      {
        transport_number: 'devk900010',
      },
    );

    expect(res.isError).toBe(false);
    const json = JSON.parse(res.content[0].text);
    expect(json.resolved_via).toBe('e070');
    expect(json.transport).toMatchObject({
      number: 'DEVK900010',
      description: 'Demo request | with a bar',
      type: 'K',
      status: 'D',
      status_text: 'Modifiable',
      owner: 'DEMOUSER',
      changed_at: '2026-10-14T08:22:24',
    });
    expect(json.task_count).toBe(1);
    expect(json.tasks[0]).toMatchObject({
      number: 'DEVK900011',
      description: 'Demo task',
    });
    expect(json.tasks[0].objects).toHaveLength(2);
    expect(json.objects).toEqual([
      {
        name: 'ZCL_DEMO',
        type: 'CLAS',
        pgmid: 'R3TR',
        position: 1,
        lock_status: 'X',
      },
      {
        name: 'Z_DEMO_FM',
        type: 'FUNC',
        pgmid: 'LIMU',
        position: 2,
        lock_status: '',
      },
    ]);
    // One call per table, all through SOAP RFC.
    expect(connection.makeAdtRequest).toHaveBeenCalledTimes(3);
    expect(connection.makeAdtRequest.mock.calls[0][0].url).toContain(
      '/sap/bc/soap/rfc',
    );
  });

  it('lists modifiable requests of a user from E070 / E07T', async () => {
    process.env.ABAP_RELEASE = '731';
    const connection = fakeConnection({
      E070: [
        'DEVK900010          |K|D|QAS|DEMOUSER    ',
        'DEVK900020          |W|L|QAS|DEMOUSER    ',
      ],
      E07T: ['DEVK900010          |E|Demo request'],
    });

    const res: any = await handleListTransports(
      { connection, logger: undefined } as any,
      { user: 'demouser' },
    );

    const json = JSON.parse(res.content[0].text);
    expect(json.count).toBe(2);
    expect(json.transports).toEqual([
      {
        number: 'DEVK900020',
        description: '',
        type: 'W',
        status: 'L',
        owner: 'DEMOUSER',
        target: 'QAS',
      },
      {
        number: 'DEVK900010',
        description: 'Demo request',
        type: 'K',
        status: 'D',
        owner: 'DEMOUSER',
        target: 'QAS',
      },
    ]);
    const where = connection.makeAdtRequest.mock.calls[0][0].data as string;
    expect(where).toContain('AS4USER = &apos;DEMOUSER&apos;');
    expect(where).toContain('TRSTATUS = &apos;D&apos;');
  });

  it('reports a missing request', async () => {
    process.env.ABAP_RELEASE = '731';
    await expect(
      handleGetTransport(
        { connection: fakeConnection({}), logger: undefined } as any,
        {
          transport_number: 'DEVK999999',
        },
      ),
    ).rejects.toThrow(/not found \(E070\)/);
  });
});
