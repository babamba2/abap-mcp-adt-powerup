import {
  buildDumpId,
  getDumpWithFallback,
  isOlderThanFeedWindow,
  LEGACY_DUMP_DETAIL_HINT,
  legacyDumpSupplement,
  listLegacyDumps,
  mapDumpListResult,
  toSapDate,
} from '../../lib/legacyDumps';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/rfcBackend', () => ({ callDispatch: jest.fn() }));
const dispatch = callDispatch as jest.Mock;
const conn = {} as any;

const row = {
  DATUM: '2026-10-19',
  UZEIT: '22:04:21',
  AHOST: 'hkderpd1_HKD_10',
  UNAME: 'GITPP000',
  MANDT: '300',
  MODNO: '1',
  RUNTIME_ERROR: 'CONVT_NO_NUMBER',
  PROGRAM: '/1BCDWB/SAPLSF00001098',
  INCLUDE: '/1BCDWB/LSF00001098F01',
  LINE: '616',
};

describe('legacy ST22 dumps (ECC, ADT feed limited to 24 hours)', () => {
  const env = process.env.SAP_VERSION;
  beforeEach(() => {
    dispatch.mockReset();
    process.env.SAP_VERSION = 'ECC';
  });
  afterAll(() => {
    process.env.SAP_VERSION = env;
  });

  it('normalises dates', () => {
    expect(toSapDate('2026-10-19')).toBe('20261019');
    expect(toSapDate('20261019220000')).toBe('20261019');
    expect(toSapDate('')).toBe('');
  });

  it('detects a from date outside the feed window', () => {
    const now = Date.UTC(2026, 9, 26, 2, 0, 0);
    expect(isOlderThanFeedWindow('20261019', now)).toBe(true);
    expect(isOlderThanFeedWindow('20261026', now)).toBe(false);
    expect(isOlderThanFeedWindow(undefined, now)).toBe(false);
  });

  it('builds the fixed-width ADT dump id', () => {
    const id = buildDumpId({
      datum: '2026-10-19',
      uzeit: '22:04:21',
      ahost: 'hkderpd1_HKD_10',
      uname: 'GITPP000',
      mandt: '300',
      modno: '1',
    });
    expect(id.slice(0, 14)).toBe('20261019220421');
    expect(id.slice(14, 46)).toBe('hkderpd1_HKD_10'.padEnd(32));
    expect(id.slice(46, 58)).toBe('GITPP000'.padEnd(12));
    expect(id.slice(58, 61)).toBe('300');
    expect(id.slice(61)).toBe('1');
  });

  it('maps upper-case dispatcher rows', () => {
    const { dumps, truncated } = mapDumpListResult({
      COUNT: 1,
      TRUNCATED: '',
      DUMPS: [row],
    });
    expect(truncated).toBe(false);
    expect(dumps[0]).toMatchObject({
      date: '2026-10-19',
      time: '22:04:21',
      user: 'GITPP000',
      client: '300',
      runtime_error: 'CONVT_NO_NUMBER',
      program: '/1BCDWB/SAPLSF00001098',
      line: '616',
    });
    expect(dumps[0].dump_id.startsWith('20261019220421hkderpd1_HKD_10')).toBe(
      true,
    );
  });

  it('calls DUMP_LIST with SAP dates and reports a missing action clearly', async () => {
    dispatch.mockResolvedValueOnce({
      result: { DUMPS: [row], TRUNCATED: 'X' },
      subrc: 0,
      message: '1 dump(s)',
    });
    const list = await listLegacyDumps(conn, {
      from: '2026-10-19',
      to: '2026-10-19',
      user: 'GITPP000',
    });
    expect(dispatch).toHaveBeenCalledWith(conn, 'DUMP_LIST', {
      date_from: '20261019',
      date_to: '20261019',
      user: 'GITPP000',
      max_rows: 200,
    });
    expect(list).toMatchObject({ count: 1, truncated: true });

    dispatch.mockResolvedValueOnce({
      result: {},
      subrc: 4,
      message: 'Unknown action: DUMP_LIST',
    });
    await expect(listLegacyDumps(conn, { from: '20261019' })).rejects.toThrow(
      /reinstall the sc4sap ABAP utilities/,
    );
  });

  it('supplements only on ECC, for an old from or an empty feed, and never throws', async () => {
    process.env.SAP_VERSION = 'S4';
    expect(
      await legacyDumpSupplement(conn, { from: '20200101', feedCount: 0 }),
    ).toBeUndefined();
    process.env.SAP_VERSION = 'ECC';
    expect(await legacyDumpSupplement(conn, { feedCount: 3 })).toBeUndefined();
    dispatch.mockRejectedValueOnce(new Error('HTTP 500'));
    expect(await legacyDumpSupplement(conn, { feedCount: 0 })).toEqual({
      error: 'HTTP 500',
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('explains a 404 single-dump read on ECC only', async () => {
    const id = '20261019220421hkderpd1_HKD_10';
    const ok = await getDumpWithFallback(
      conn,
      () => Promise.resolve({ status: 200 }),
      id,
    );
    expect(ok.status).toBe(200);
    const notFound = () =>
      Promise.reject(
        Object.assign(new Error('Request failed with status code 404'), {
          response: { status: 404 },
        }),
      );
    await expect(getDumpWithFallback(conn, notFound, id)).rejects.toThrow(
      LEGACY_DUMP_DETAIL_HINT,
    );
    await expect(
      getDumpWithFallback(
        conn,
        () => Promise.reject({ response: { status: 403 } }),
        id,
      ),
    ).rejects.toEqual({ response: { status: 403 } });
    process.env.SAP_VERSION = 'S4';
    await expect(getDumpWithFallback(conn, notFound, id)).rejects.toThrow(
      /^Request failed with status code 404$/,
    );
  });
});
