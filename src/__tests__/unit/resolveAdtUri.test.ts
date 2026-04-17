import { resolveAdtUri } from '../../lib/resolveAdtUri';

describe('resolveAdtUri', () => {
  it('honors explicit uri input over name-based resolution', () => {
    expect(
      resolveAdtUri({
        name: 'ANYTHING',
        type: 'PROG/P',
        uri: '/sap/bc/adt/custom/path',
      }),
    ).toBe('/sap/bc/adt/custom/path');
  });

  it('maps PROG/I (include) to /sap/bc/adt/programs/includes/{name}', () => {
    expect(resolveAdtUri({ name: 'ZMCP_INC01', type: 'PROG/I' })).toBe(
      '/sap/bc/adt/programs/includes/zmcp_inc01',
    );
  });

  it('maps PROG/P (program) to /sap/bc/adt/programs/programs/{name}', () => {
    expect(resolveAdtUri({ name: 'ZMCP_MAIN', type: 'PROG/P' })).toBe(
      '/sap/bc/adt/programs/programs/zmcp_main',
    );
  });

  it('maps CLAS/OC to /sap/bc/adt/oo/classes/{name}', () => {
    expect(resolveAdtUri({ name: 'ZCL_FOO', type: 'CLAS/OC' })).toBe(
      '/sap/bc/adt/oo/classes/zcl_foo',
    );
  });

  it('maps FUGR/FF (function module) with parent to nested path', () => {
    expect(
      resolveAdtUri({
        name: 'Z_FM_BAR',
        type: 'FUGR/FF',
        parentName: 'Z_FG_BAR',
      }),
    ).toBe('/sap/bc/adt/functions/groups/z_fg_bar/fmodules/z_fm_bar');
  });

  it('throws when FUGR/FF is given without parentName', () => {
    expect(() => resolveAdtUri({ name: 'Z_FM_BAR', type: 'FUGR/FF' })).toThrow(
      /requires parentName/,
    );
  });

  it('maps FUGR/I (function-group include) with parent to nested path', () => {
    expect(
      resolveAdtUri({
        name: 'ZINC_BAR',
        type: 'FUGR/I',
        parentName: 'Z_FG_BAR',
      }),
    ).toBe('/sap/bc/adt/functions/groups/z_fg_bar/includes/zinc_bar');
  });

  it('maps CDS (DDLS), metadata ext (DDLX), BDEF, DCLS correctly', () => {
    expect(resolveAdtUri({ name: 'Z_CDS_X', type: 'DDLS/DF' })).toBe(
      '/sap/bc/adt/ddic/ddl/sources/z_cds_x',
    );
    expect(resolveAdtUri({ name: 'Z_EXT_X', type: 'DDLX/EX' })).toBe(
      '/sap/bc/adt/ddic/ddlx/sources/z_ext_x',
    );
    expect(resolveAdtUri({ name: 'Z_BDEF_X', type: 'BDEF/BDO' })).toBe(
      '/sap/bc/adt/ddic/bdef/sources/z_bdef_x',
    );
    expect(resolveAdtUri({ name: 'Z_DCL_X', type: 'DCLS/DL' })).toBe(
      '/sap/bc/adt/acm/dcl/sources/z_dcl_x',
    );
  });

  it('URL-encodes namespace slashes in object names', () => {
    expect(resolveAdtUri({ name: '/SAP/ZINC', type: 'PROG/I' })).toBe(
      '/sap/bc/adt/programs/includes/%2fsap%2fzinc',
    );
  });

  it('throws loudly on unknown type rather than silently building a bad URI', () => {
    expect(() => resolveAdtUri({ name: 'ZFOO', type: 'UNKNOWN_TYPE' })).toThrow(
      /no URI mapping for type/,
    );
  });

  it('throws when neither uri nor name is given', () => {
    expect(() => resolveAdtUri({ name: '', type: 'PROG/P' })).toThrow(
      /name is required/,
    );
  });
});
