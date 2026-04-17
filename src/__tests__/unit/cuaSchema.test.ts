import {
  type CuaData,
  mergeCuaData,
  normalizeCuaInput,
  validateCuaData,
} from '../../lib/cuaSchema';

describe('normalizeCuaInput', () => {
  it('parses a JSON string', () => {
    const out = normalizeCuaInput(
      '{"ADM":{"ACTCODE":"1"},"STA":[{"CODE":"X"}]}',
    );
    expect(out.ADM).toEqual({ ACTCODE: '1' });
    expect(out.STA).toEqual([{ CODE: 'X' }]);
  });

  it('accepts an already-parsed object', () => {
    const out = normalizeCuaInput({ ADM: { ACTCODE: '2' }, STA: [] });
    expect(out.ADM).toEqual({ ACTCODE: '2' });
    expect(out.STA).toEqual([]);
  });

  it('upper-cases top-level keys (back-compat for camelCase callers)', () => {
    const out = normalizeCuaInput({
      adm: { ACTCODE: '3' },
      sta: [{ CODE: 'Y' }],
    });
    expect(out.ADM).toEqual({ ACTCODE: '3' });
    expect(out.STA).toEqual([{ CODE: 'Y' }]);
  });

  it('throws on invalid JSON string', () => {
    expect(() => normalizeCuaInput('{bad')).toThrow(/not valid JSON/);
  });

  it('throws when a table field is not an array', () => {
    expect(() => normalizeCuaInput({ STA: 'oops' })).toThrow(
      /STA must be an array/,
    );
  });
});

describe('validateCuaData', () => {
  it('returns empty array on a well-formed payload', () => {
    const data: CuaData = {
      ADM: { ACTCODE: '000001' },
      STA: [{ CODE: 'STATUS_0100', PFKCODE: '000001' }],
      FUN: [{ CODE: 'BACK' }],
      PFK: [{ CODE: '000001', PFNO: '03', FUNCODE: 'BACK' }],
      BUT: [{ PFK_CODE: '000001', CODE: '0001', NO: '01', PFNO: '03' }],
      TIT: [{ CODE: 'T01', TEXT: 'Title' }],
    };
    expect(validateCuaData(data)).toEqual([]);
  });

  it('flags STA row missing CODE', () => {
    const problems = validateCuaData({
      STA: [{ CODE: '' as any }],
    });
    expect(problems).toEqual([
      expect.objectContaining({ table: 'STA', field: 'CODE' }),
    ]);
  });

  it('flags PFK rows missing PFNO / FUNCODE', () => {
    const problems = validateCuaData({
      PFK: [{ CODE: '000001' } as any],
    });
    const fields = problems.map((p) => p.field);
    expect(fields).toContain('PFNO');
    expect(fields).toContain('FUNCODE');
  });

  it('flags BUT rows missing any of PFK_CODE / CODE / NO / PFNO', () => {
    const problems = validateCuaData({
      BUT: [{ CODE: '0001' } as any],
    });
    const fields = problems.map((p) => p.field).sort();
    expect(fields).toEqual(['NO', 'PFK_CODE', 'PFNO']);
  });

  it('warns when STA.PFKCODE has no matching PFK.CODE row', () => {
    const problems = validateCuaData({
      STA: [{ CODE: 'STATUS_0100', PFKCODE: '000099' }],
      PFK: [{ CODE: '000001', PFNO: '03', FUNCODE: 'BACK' }],
    });
    expect(problems).toEqual([
      expect.objectContaining({
        table: 'STA',
        field: 'PFKCODE',
        message: expect.stringMatching(/no matching PFK.CODE/),
      }),
    ]);
  });
});

describe('mergeCuaData', () => {
  const base: CuaData = {
    ADM: { ACTCODE: '000001', MENCODE: '000001' },
    STA: [
      { CODE: 'STATUS_0100', INT_NOTE: 'orig list' },
      { CODE: 'STATUS_0200', INT_NOTE: 'orig detail' },
    ],
    FUN: [
      { CODE: 'BACK', FUN_TEXT: 'Back' },
      { CODE: 'EXIT', FUN_TEXT: 'Exit' },
    ],
    PFK: [
      { CODE: '000001', PFNO: '03', FUNCODE: 'BACK' },
      { CODE: '000001', PFNO: '15', FUNCODE: 'EXIT' },
    ],
    BUT: [
      { PFK_CODE: '000001', CODE: '0001', NO: '01', PFNO: '03' },
      { PFK_CODE: '000001', CODE: '0001', NO: '02', PFNO: '15' },
    ],
    TIT: [{ CODE: 'T01', TEXT: 'Old title' }],
  };

  it('preserves untouched tables when changes omits them', () => {
    const merged = mergeCuaData(base, {
      FUN: [{ CODE: 'BACK', ICON_ID: '@03@' }],
    });
    expect(merged.STA).toEqual(base.STA);
    expect(merged.PFK).toEqual(base.PFK);
    expect(merged.BUT).toEqual(base.BUT);
    expect(merged.TIT).toEqual(base.TIT);
  });

  it('field-merges a matched row (changes win, base fields kept)', () => {
    const merged = mergeCuaData(base, {
      FUN: [{ CODE: 'BACK', ICON_ID: '@03@' }],
    });
    // BACK should keep FUN_TEXT from base, add ICON_ID from changes.
    const back = merged.FUN?.find((f: any) => f.CODE === 'BACK');
    expect(back).toEqual({ CODE: 'BACK', FUN_TEXT: 'Back', ICON_ID: '@03@' });
    // EXIT untouched
    const exit = merged.FUN?.find((f: any) => f.CODE === 'EXIT');
    expect(exit).toEqual({ CODE: 'EXIT', FUN_TEXT: 'Exit' });
  });

  it('appends new rows that do not match any base row', () => {
    const merged = mergeCuaData(base, {
      FUN: [{ CODE: 'CANC', FUN_TEXT: 'Cancel' }],
    });
    expect(merged.FUN).toHaveLength(3);
    expect(merged.FUN?.map((f: any) => f.CODE).sort()).toEqual([
      'BACK',
      'CANC',
      'EXIT',
    ]);
  });

  it('uses composite keys for PFK (CODE + PFNO)', () => {
    const merged = mergeCuaData(base, {
      PFK: [{ CODE: '000001', PFNO: '03', FUNCODE: 'BACK', FUNNO: '001' }],
    });
    const row = merged.PFK?.find((p) => p.CODE === '000001' && p.PFNO === '03');
    expect(row).toEqual({
      CODE: '000001',
      PFNO: '03',
      FUNCODE: 'BACK',
      FUNNO: '001',
    });
    // EXIT F-key row still there untouched
    expect(
      merged.PFK?.find((p) => p.CODE === '000001' && p.PFNO === '15'),
    ).toEqual({ CODE: '000001', PFNO: '15', FUNCODE: 'EXIT' });
  });

  it('uses composite keys for BUT (PFK_CODE + CODE + NO)', () => {
    const merged = mergeCuaData(base, {
      BUT: [{ PFK_CODE: '000001', CODE: '0001', NO: '03', PFNO: '12' }],
    });
    expect(merged.BUT).toHaveLength(3);
    const pos3 = merged.BUT?.find((b: any) => b.NO === '03');
    expect(pos3).toEqual({
      PFK_CODE: '000001',
      CODE: '0001',
      NO: '03',
      PFNO: '12',
    });
  });

  it('replaces ADM fields when provided', () => {
    const merged = mergeCuaData(base, { ADM: { PFKCODE: '000002' } });
    expect(merged.ADM).toEqual({
      ACTCODE: '000001',
      MENCODE: '000001',
      PFKCODE: '000002',
    });
  });

  it('is a pure function — does not mutate the base input', () => {
    const frozen = JSON.stringify(base);
    mergeCuaData(base, { FUN: [{ CODE: 'BACK', ICON_ID: '@02@' }] });
    expect(JSON.stringify(base)).toEqual(frozen);
  });
});
