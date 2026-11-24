import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  dispatchErrorText,
  handleGetRemoteTableContents,
  readRemoteDestinations,
  rememberRemoteDestination,
  splitWhereLines,
} from '../../handlers/table/readonly/handleGetRemoteTableContents';
import { getActiveAlias } from '../../lib/profile';
import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/rfcBackend', () => ({ callDispatch: jest.fn() }));
jest.mock('../../lib/profile', () => ({ getActiveAlias: jest.fn() }));
jest.mock('../../lib/policy/tableBlocklist', () => ({
  activeProfile: () => 'standard',
  checkTables: (names: string[]) =>
    names.filter((n) => n === 'USR02').map((n) => ({ table: n })),
  evaluateHits: (hits: Array<{ table: string }>) =>
    hits.length
      ? { kind: 'deny', message: `blocked: ${hits[0].table}` }
      : { kind: 'allow' },
}));

const dispatch = callDispatch as jest.Mock;
const alias = getActiveAlias as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;
const textOf = (r: any) => r.content[0].text as string;

describe('splitWhereLines', () => {
  it('returns no lines for an empty condition', () => {
    expect(splitWhereLines(undefined)).toEqual([]);
    expect(splitWhereLines('   ')).toEqual([]);
  });

  it('keeps every line within 72 characters and the words in order', () => {
    const cond =
      "VBELN IN ('0000000001', '0000000002', '0000000003', '0000000004', '0000000005') AND VKORG = '1000' AND AUART = 'OR'";
    const lines = splitWhereLines(cond);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(72);
    expect(lines.join(' ')).toBe(cond);
  });

  it('never splits a quoted literal that contains spaces', () => {
    const literal = "'A LITERAL WITH SEVERAL SPACES INSIDE IT'";
    const lines = splitWhereLines(
      `${'X'.repeat(40)} = 'Y' AND NAME1 = ${literal}`,
    );
    expect(lines.some((l) => l.includes(literal))).toBe(true);
  });

  it("keeps an escaped quote ('') inside one literal", () => {
    expect(splitWhereLines("NAME1 = 'O''BRIEN AND CO'")).toEqual([
      "NAME1 = 'O''BRIEN AND CO'",
    ]);
  });

  it('refuses an unclosed quote', () => {
    expect(() => splitWhereLines("NAME1 = 'OPEN")).toThrow(/unclosed quote/);
  });

  it('refuses a token longer than 72 characters', () => {
    expect(() => splitWhereLines(`NAME1 = '${'A'.repeat(80)}'`)).toThrow(
      /longer than 72/,
    );
  });
});

describe('saved destinations', () => {
  let home: string;
  const cfgFile = () => path.join(home, 'profiles', 'DEV1', 'config.json');

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-dest-'));
    fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
    fs.writeFileSync(cfgFile(), JSON.stringify({ tier: 'DEV' }));
    process.env.SC4SAP_HOME_DIR = home;
    alias.mockReturnValue('DEV1');
    dispatch.mockReset();
  });

  afterEach(() => {
    delete process.env.SC4SAP_HOME_DIR;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('without a destination and none saved, asks for one', async () => {
    const r = await handleGetRemoteTableContents(ctx, { table_name: 'T001' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/none is saved for this profile/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('without a destination, lists the saved ones most recent first', async () => {
    rememberRemoteDestination('QASCLNT200');
    rememberRemoteDestination('PRDCLNT100');
    const r = await handleGetRemoteTableContents(ctx, { table_name: 'T001' });
    expect(textOf(r)).toMatch(
      /most recent first\): PRDCLNT100, QASCLNT200\. Ask the user/,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('saves a destination only after a successful read, keeping other keys', async () => {
    dispatch.mockResolvedValueOnce({
      result: { table: 'T001', rows: [], count: 0 },
    });
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 't001',
      destination: 'PRDCLNT100',
      where: "BUKRS = '1000'",
      max_rows: 99999,
    });
    expect(r.isError).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(
      ctx.connection,
      'REMOTE_READ',
      expect.objectContaining({
        destination: 'PRDCLNT100',
        table_name: 'T001',
        options: ["BUKRS = '1000'"],
        max_rows: 5000,
        skip_rows: 0,
      }),
    );
    expect(readRemoteDestinations()).toEqual(['PRDCLNT100']);
    expect(JSON.parse(fs.readFileSync(cfgFile(), 'utf8')).tier).toBe('DEV');

    dispatch.mockRejectedValueOnce(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=REMOTE_READ, subrc=4): REMOTE_READ: destination NO_SUCH_DEST_X is not defined in SM59',
      ),
    );
    const bad = await handleGetRemoteTableContents(ctx, {
      table_name: 'T001',
      destination: 'NO_SUCH_DEST_X',
    });
    expect(bad.isError).toBe(true);
    expect(textOf(bad)).toMatch(
      /Error: REMOTE_READ: destination NO_SUCH_DEST_X is not defined in SM59$/,
    );
    expect(readRemoteDestinations()).toEqual(['PRDCLNT100']);
  });

  it('keeps at most 10 destinations', () => {
    for (let i = 0; i < 12; i++) rememberRemoteDestination(`D${i}`);
    const list = readRemoteDestinations();
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('D11');
  });

  it('refuses a blocklisted table before calling SAP', async () => {
    const r = await handleGetRemoteTableContents(ctx, {
      table_name: 'usr02',
      destination: 'PRDCLNT100',
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/blocked: USR02/);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('dispatchErrorText', () => {
  it('explains a dispatcher without the action', () => {
    expect(
      dispatchErrorText(
        new Error(
          'ZMCP_ADT_DISPATCH error (action=REMOTE_READ, subrc=4): Unknown action: REMOTE_READ',
        ),
      ),
    ).toMatch(/Upload the current dispatcher source/);
  });
});
