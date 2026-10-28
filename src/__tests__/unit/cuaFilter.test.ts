import { compactCua, filterCua } from '../../lib/cuaFilter';

// Two statuses sharing one program interface: MAIN (keys K1, toolbar B1, menu bar A1)
// and POPUP (keys K2). Only MAIN's rows may survive a status_name=MAIN filter.
const cua = {
  ADM: { ACTCODE: '000001', PFKCODE: '000001' },
  STA: [
    { CODE: 'MAIN', MODAL: 'D', PFKCODE: 'K1', BUTCODE: 'B1', ACTCODE: 'A1' },
    { CODE: 'POPUP', MODAL: 'P', PFKCODE: 'K2', BUTCODE: '', ACTCODE: '' },
  ],
  SET: [
    { STATUS: 'MAIN', FUNCTION: 'SAVE' },
    { STATUS: 'MAIN', FUNCTION: 'CRPO' },
    { STATUS: 'MAIN', FUNCTION: 'BACK' },
    { STATUS: 'POPUP', FUNCTION: 'OKAY' },
  ],
  FUN: [
    { CODE: 'SAVE', TEXTNO: '001', FUN_TEXT: 'Save', ICON_ID: '@2L@' },
    { CODE: 'CRPO', TEXTNO: '001', FUN_TEXT: 'Create PO' },
    { CODE: 'BACK', TEXTNO: '001', FUN_TEXT: 'Back' },
    { CODE: 'OKAY', TEXTNO: '001', FUN_TEXT: 'Continue' },
  ],
  PFK: [
    { CODE: 'K1', PFNO: '11', FUNCODE: 'SAVE' },
    { CODE: 'K1', PFNO: '13', FUNCODE: 'CRPO' },
    { CODE: 'K1', PFNO: '03', FUNCODE: 'BACK' },
    { CODE: 'K2', PFNO: '00', FUNCODE: 'OKAY' },
  ],
  BUT: [
    { PFK_CODE: 'K1', CODE: 'B1', NO: '01', PFNO: '13' },
    { PFK_CODE: 'K2', CODE: 'B2', NO: '01', PFNO: '00' },
  ],
  ACT: [{ CODE: 'A1', NO: '01', MENUCODE: 'M1' }],
  MEN: [
    { CODE: 'M1', NO: '01', REF_CODE: 'M2' },
    { CODE: 'M2', NO: '01', REF_CODE: 'SAVE' },
    { CODE: 'M9', NO: '01', REF_CODE: 'OKAY' },
  ],
  MTX: [
    { CODE: 'M1', TEXT: 'Order' },
    { CODE: 'M2', TEXT: 'Edit' },
    { CODE: 'M9', TEXT: 'Other' },
  ],
  TIT: [{ CODE: 'T1', TEXT: 'Title' }],
};

describe('filterCua', () => {
  it('returns the input unchanged without a filter', () => {
    expect(filterCua(cua, {})).toBe(cua);
  });

  it('narrows every table to one status', () => {
    const f: any = filterCua(cua, { statusName: 'main' });
    expect(f.STA.map((r: any) => r.CODE)).toEqual(['MAIN']);
    expect(f.SET).toHaveLength(3);
    expect(f.FUN.map((r: any) => r.CODE)).toEqual(['SAVE', 'CRPO', 'BACK']);
    expect(f.PFK.every((r: any) => r.CODE === 'K1')).toBe(true);
    expect(f.BUT).toEqual([
      { PFK_CODE: 'K1', CODE: 'B1', NO: '01', PFNO: '13' },
    ]);
    expect(f.ACT).toHaveLength(1);
    expect(f.MEN.map((r: any) => r.CODE)).toEqual(['M1', 'M2']);
    expect(f.MTX.map((r: any) => r.CODE)).toEqual(['M1', 'M2']);
    expect(f.TIT).toBeUndefined();
    expect(f.ADM).toEqual(cua.ADM);
  });

  it('narrows to function codes, alone or after a status', () => {
    const f: any = filterCua(cua, { functionCodes: ['crpo'] });
    expect(f.FUN.map((r: any) => r.CODE)).toEqual(['CRPO']);
    expect(f.SET).toEqual([{ STATUS: 'MAIN', FUNCTION: 'CRPO' }]);
    expect(f.PFK).toEqual([{ CODE: 'K1', PFNO: '13', FUNCODE: 'CRPO' }]);
    expect(f.BUT).toHaveLength(1);
    expect(f.STA).toHaveLength(2);
    const g: any = filterCua(cua, {
      statusName: 'POPUP',
      functionCodes: ['CRPO'],
    });
    expect(g.FUN).toEqual([]);
  });
});

describe('compactCua', () => {
  it('lists each function of a status with text, icon, key and toolbar', () => {
    const c = compactCua(filterCua(cua, { statusName: 'MAIN' }));
    expect(c.statuses).toHaveLength(1);
    expect(c.statuses[0]).toEqual({
      code: 'MAIN',
      type: 'D',
      functions: [
        { code: 'SAVE', text: 'Save', icon: '@2L@', fkey: '11' },
        { code: 'CRPO', text: 'Create PO', fkey: '13', toolbar: true },
        { code: 'BACK', text: 'Back', fkey: '03' },
      ],
    });
  });

  it('is much smaller than the full definition', () => {
    const full = JSON.stringify(cua, null, 2).length;
    const small = JSON.stringify(
      compactCua(filterCua(cua, { statusName: 'MAIN' })),
    ).length;
    expect(small * 3).toBeLessThan(full);
  });
});
