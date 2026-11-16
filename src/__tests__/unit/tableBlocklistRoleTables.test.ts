import { checkTables } from '../../lib/policy/tableBlocklist';

describe('table blocklist — PFCG role tables', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('denies AGR_1016 and AGR_TIMEB in every profile (minimal tier, like AGR_1251)', () => {
    for (const profile of ['minimal', 'standard', 'strict']) {
      process.env.MCP_BLOCKLIST_PROFILE = profile;
      delete process.env.MCP_ALLOW_TABLE;
      const hits = checkTables(['AGR_1016', 'AGR_TIMEB', 'AGR_1251']);
      expect(hits.map((h) => h.table).sort()).toEqual([
        'AGR_1016',
        'AGR_1251',
        'AGR_TIMEB',
      ]);
      expect(hits.every((h) => h.action === 'deny')).toBe(true);
    }
  });

  it('opens them only through MCP_ALLOW_TABLE of the launching process', () => {
    process.env.MCP_BLOCKLIST_PROFILE = 'minimal';
    process.env.MCP_ALLOW_TABLE = 'AGR_1016,AGR_TIMEB';
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    try {
      expect(checkTables(['AGR_1016', 'AGR_TIMEB'])).toEqual([]);
      expect(checkTables(['AGR_1251']).map((h) => h.table)).toEqual([
        'AGR_1251',
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});
