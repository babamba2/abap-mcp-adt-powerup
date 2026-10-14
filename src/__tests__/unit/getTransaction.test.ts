import {
  buildTransactionInfo,
  parseTransactionParam,
} from '../../handlers/system/readonly/handleGetTransaction';

describe('GetTransaction (TSTC / TSTCP)', () => {
  it('parses parameter and variant transactions', () => {
    expect(parseTransactionParam('/*SM30 VIEWNAME=ZMY_VIEW;UPDATE=X;')).toEqual(
      {
        kind: 'parameter',
        target: 'SM30',
        parameters: { VIEWNAME: 'ZMY_VIEW', UPDATE: 'X' },
      },
    );
    expect(
      parseTransactionParam('/NSE16 DATABROWSE-TABLENAME=T001'),
    ).toMatchObject({
      kind: 'parameter',
      target: 'SE16',
    });
    expect(parseTransactionParam('@ZVARIANT')).toEqual({ kind: 'variant' });
    expect(parseTransactionParam('')).toEqual({ kind: null });
  });

  it('merges TSTC and TSTCP rows per requested t-code', () => {
    const info = buildTransactionInfo(
      ['ZT_REPORT', 'ZT_VIEW', 'ZT_MISSING'],
      [
        { TCODE: 'ZT_REPORT', PGMNA: 'ZR_REPORT', DYPNO: '1000' },
        { TCODE: 'ZT_VIEW', PGMNA: '', DYPNO: '0000' },
      ],
      [{ TCODE: 'ZT_VIEW', PARAM: '/*SM30 VIEWNAME=ZV_TEST;UPDATE=X;' }],
    );
    expect(info[0]).toEqual({
      tcode: 'ZT_REPORT',
      found: true,
      kind: 'program',
      program: 'ZR_REPORT',
      screen: '1000',
    });
    expect(info[1]).toMatchObject({
      tcode: 'ZT_VIEW',
      kind: 'parameter',
      target_tcode: 'SM30',
      parameters: { VIEWNAME: 'ZV_TEST' },
    });
    expect(info[1].program).toBeUndefined();
    expect(info[2]).toEqual({ tcode: 'ZT_MISSING', found: false });
  });
});
