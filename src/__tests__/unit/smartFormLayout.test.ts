/**
 * Unit tests for GetSmartFormLayout: ZMCP_ADT_DISPATCH action SSF_LAYOUT,
 * unit conversion to mm, window types, error translation.
 * SAP calls are mocked; form names are invented.
 */

import { callDispatch } from '../../lib/rfcBackend';

jest.mock('../../lib/rfcBackend', () => {
  const actual = jest.requireActual('../../lib/rfcBackend');
  return { ...actual, callDispatch: jest.fn() };
});

import { handleGetSmartFormLayout } from '../../handlers/system/readonly/handleGetSmartFormLayout';
import {
  SSF_LAYOUT_INSTALL_HINT,
  toMm,
  windowTypeName,
} from '../../lib/smartFormLayout';

const mockDispatch = callDispatch as jest.Mock;
const ctx = { connection: {} as any, logger: undefined } as any;

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  jest.clearAllMocks();
});

function win(
  name: string,
  wtype: string,
  coords: [number, string, number, string, number, string, number, string],
  extra: Record<string, unknown> = {},
) {
  const [l, ul, t, ut, w, uw, h, uh] = coords;
  return {
    name,
    caption: `${name} caption`,
    wtype,
    wlevel: 0,
    wleft: l,
    u_wleft: ul,
    wtop: t,
    u_wtop: ut,
    wwidth: w,
    u_wwidth: uw,
    wheight: h,
    u_wheight: uh,
    wframe: 0,
    u_wframe: 'PT',
    wshading: 0,
    wempty: '',
    ...extra,
  };
}

function layout(windows: any[], variant: Record<string, unknown> = {}) {
  return {
    form: 'ZDEMO_FORM',
    language: 'E',
    masterLanguage: 'E',
    variants: [
      {
        variant: '',
        pageFormat: 'DINA4',
        cpi: 10,
        lpi: 6,
        stdStyle: 'SYSTEM',
        ...variant,
        pages: [
          {
            name: '%PAGE1',
            caption: 'New Page',
            nextPage: '%PAGE1',
            orientation: '',
            printMode: '',
            windows,
          },
        ],
      },
    ],
  };
}

async function run(args: any) {
  const res: any = await handleGetSmartFormLayout(ctx, args);
  return res;
}

function body(res: any) {
  return JSON.parse(res.content[0].text);
}

function errorText(res: any): string {
  return res.content.map((c: any) => c.text ?? '').join(' ');
}

describe('GetSmartFormLayout', () => {
  it('maps the baseline form to mm (A4 portrait, CM units)', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([
        win('%WINDOW1', 'T', [1, 'CM', 0, 'CM', 19, 'CM', 14.5, 'CM']),
        win('%WINDOW2', 'T', [1, 'CM', 14.5, 'CM', 19, 'CM', 14.5, 'CM']),
        win('MAIN', 'M', [1, 'CM', 0.5, 'CM', 19, 'CM', 29, 'CM']),
      ]),
    });

    const res = await run({ form_name: ' zdemo_form ' });
    expect(res.isError).toBe(false);
    expect(mockDispatch).toHaveBeenCalledWith(ctx.connection, 'SSF_LAYOUT', {
      form_name: 'ZDEMO_FORM',
      language: '',
    });

    const out = body(res);
    expect(out.form).toBe('ZDEMO_FORM');
    expect(out.masterLanguage).toBe('E');
    expect(out.pages).toHaveLength(1);
    const page = out.pages[0];
    expect(page).toEqual(
      expect.objectContaining({
        name: '%PAGE1',
        format: 'DINA4',
        orientation: 'portrait',
        nextPage: '%PAGE1',
        cpi: 10,
        lpi: 6,
        stdStyle: 'SYSTEM',
      }),
    );
    const mm = page.windows.map((w: any) => [
      w.name,
      w.leftMm,
      w.topMm,
      w.widthMm,
      w.heightMm,
    ]);
    expect(mm).toEqual([
      ['%WINDOW1', 10, 0, 190, 145],
      ['%WINDOW2', 10, 145, 190, 145],
      ['MAIN', 10, 5, 190, 290],
    ]);
    expect(page.windows[0]).toEqual(
      expect.objectContaining({
        type: 'SECONDARY',
        typeCode: 'T',
        left: { value: 1, unit: 'CM' },
        height: { value: 14.5, unit: 'CM' },
      }),
    );
    expect(page.windows[2].type).toBe('MAIN');
    // No frame / shading / always-draw flags when they are not set.
    expect(page.windows[0].frame).toBeUndefined();
    expect(page.windows[0].shading).toBeUndefined();
    expect(page.windows[0].alwaysDrawBox).toBeUndefined();
    expect(out.path).toMatch(/^dispatch-/);
  });

  it('converts every unit', () => {
    expect(toMm(2, 'CM')).toBe(20);
    expect(toMm(12.5, 'MM')).toBe(12.5);
    expect(toMm(1, 'IN')).toBe(25.4);
    expect(toMm(72, 'PT')).toBe(25.4);
    expect(toMm(10, 'PT')).toBe(3.53);
    expect(toMm(1440, 'TW')).toBe(25.4);
    expect(toMm(6, 'LN')).toBe(25.4);
    expect(toMm(10, 'CH')).toBe(25.4);
    expect(toMm(3, 'ln')).toBe(12.7);
    expect(toMm(1, 'XX')).toBeNull();
    expect(toMm('', 'CM')).toBeNull();
  });

  it('uses the variant LPI / CPI for LN and CH', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([win('W1', 'T', [12, 'CH', 8, 'LN', 24, 'CH', 4, 'LN'])], {
        cpi: 12,
        lpi: 8,
      }),
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM' }));
    const w = out.pages[0].windows[0];
    expect(out.pages[0].cpi).toBe(12);
    expect(out.pages[0].lpi).toBe(8);
    expect([w.leftMm, w.topMm, w.widthMm, w.heightMm]).toEqual([
      25.4, 25.4, 50.8, 12.7,
    ]);
  });

  it('falls back to LPI 6 / CPI 10 when the variant has none', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([win('W1', 'T', [10, 'CH', 6, 'LN', 20, 'CH', 3, 'LN'])], {
        cpi: 0,
        lpi: null,
      }),
    });
    const w = body(await run({ form_name: 'ZDEMO_FORM' })).pages[0].windows[0];
    expect([w.leftMm, w.topMm, w.widthMm, w.heightMm]).toEqual([
      25.4, 25.4, 50.8, 12.7,
    ]);
  });

  it('handles mixed units in one window', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([
        win('MIXED', 'C', [1, 'IN', 36, 'PT', 50, 'MM', 2880, 'TW'], {
          wframe: 0.5,
          u_wframe: 'PT',
          wshading: 20,
          wempty: 'X',
        }),
      ]),
    });
    const w = body(await run({ form_name: 'ZDEMO_FORM' })).pages[0].windows[0];
    expect([w.leftMm, w.topMm, w.widthMm, w.heightMm]).toEqual([
      25.4, 12.7, 50, 50.8,
    ]);
    expect(w.left).toEqual({ value: 1, unit: 'IN' });
    expect(w.top).toEqual({ value: 36, unit: 'PT' });
    expect(w.type).toBe('COPIES');
    expect(w.frame).toEqual({ value: 0.5, unit: 'PT' });
    expect(w.shading).toBe(20);
    expect(w.alwaysDrawBox).toBe(true);
  });

  it('keeps a window without output attributes, without coordinates', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([
        {
          name: 'NOPOS',
          caption: '',
          wtype: 'L',
          wlevel: 0,
        },
      ]),
    });
    const w = body(await run({ form_name: 'ZDEMO_FORM' })).pages[0].windows[0];
    expect(w).toEqual({
      name: 'NOPOS',
      caption: '',
      type: 'FINAL',
      typeCode: 'L',
      level: 0,
    });
  });

  it('names known window types and passes unknown codes through', () => {
    expect(windowTypeName('M')).toBe('MAIN');
    expect(windowTypeName('T')).toBe('SECONDARY');
    expect(windowTypeName('C')).toBe('COPIES');
    expect(windowTypeName('L')).toBe('FINAL');
    expect(windowTypeName('G')).toBe('GRAPHIC');
    expect(windowTypeName('A')).toBe('ADDRESS');
    expect(windowTypeName('Q')).toBe('Q');
  });

  it('answers with an install hint when the action is missing', async () => {
    mockDispatch.mockRejectedValue(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=SSF_LAYOUT, subrc=4): Unknown action: SSF_LAYOUT',
      ),
    );
    const res = await run({ form_name: 'ZDEMO_FORM' });
    expect(res.isError).toBe(true);
    expect(errorText(res)).toContain('ZMCP_SSF_LAYOUT');
    expect(errorText(res)).toContain('sc4sap/abap/README.md');
  });

  it('answers with an install hint on a SOAP fault / missing FM', async () => {
    mockDispatch.mockRejectedValue(
      new Error('SOAP Fault: FU_NOT_FOUND ZMCP_ADT_DISPATCH'),
    );
    const res = await run({ form_name: 'ZDEMO_FORM' });
    expect(res.isError).toBe(true);
    expect(errorText(res)).toContain(SSF_LAYOUT_INSTALL_HINT.substring(0, 40));

    mockDispatch.mockRejectedValue(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=SSF_LAYOUT, subrc=8): Function module ZMCP_SSF_LAYOUT not found',
      ),
    );
    const res2 = await run({ form_name: 'ZDEMO_FORM' });
    expect(errorText(res2)).toContain('sc4sap/abap/README.md');
  });

  it('reports a missing form (subrc 4)', async () => {
    mockDispatch.mockRejectedValue(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=SSF_LAYOUT, subrc=4): SmartForm ZNOPE not found',
      ),
    );
    const res = await run({ form_name: 'znope' });
    expect(res.isError).toBe(true);
    expect(errorText(res)).toContain('SmartForm ZNOPE not found');
    expect(errorText(res)).not.toContain('README');
  });

  it('keeps the SAP reason of a missing form (header missing vs no form)', async () => {
    const reasons = [
      'Form or text ZNOPE does not exist',
      'Form or text ZNOPE does not exist (language E)',
    ];
    for (const reason of reasons) {
      mockDispatch.mockRejectedValue(
        new Error(
          `ZMCP_ADT_DISPATCH error (action=SSF_LAYOUT, subrc=4): ${reason}`,
        ),
      );
      expect(errorText(await run({ form_name: 'ZNOPE' }))).toContain(reason);
    }
  });

  it('reports active true, and null when an older FM sends no flag', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: { ...layout([]), active: true },
    });
    expect(body(await run({ form_name: 'ZDEMO_FORM' })).active).toBe(true);

    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: { ...layout([]), status: '' },
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM' }));
    expect(out.active).toBeNull();
    expect(out).not.toHaveProperty('status');
  });

  it('passes other SAP errors through (subrc 8)', async () => {
    mockDispatch.mockRejectedValue(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=SSF_LAYOUT, subrc=8): No active version of the form',
      ),
    );
    const res = await run({ form_name: 'ZDEMO_FORM' });
    expect(errorText(res)).toContain('No active version of the form');
  });

  it('passes a 1-char SAP language key as-is', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: { ...layout([]), language: 'D' },
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM', language: ' D ' }));
    expect(mockDispatch).toHaveBeenCalledWith(ctx.connection, 'SSF_LAYOUT', {
      form_name: 'ZDEMO_FORM',
      language: 'D',
    });
    expect(out.language).toBe('D');
    expect(out.masterLanguage).toBe('E');
  });

  it('passes a 2-letter ISO language code through, upper-cased', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: { ...layout([]), language: '3' },
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM', language: 'ko' }));
    expect(mockDispatch).toHaveBeenCalledWith(ctx.connection, 'SSF_LAYOUT', {
      form_name: 'ZDEMO_FORM',
      language: 'KO',
    });
    expect(out.language).toBe('3');
  });

  it('rejects an invalid language without calling SAP', async () => {
    for (const language of ['ENG', 'E1', 'ko-KR']) {
      const res = await run({ form_name: 'ZDEMO_FORM', language });
      expect(res.isError).toBe(true);
      expect(errorText(res)).toContain('language must be');
    }
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('passes active, variant, printMode and window level through', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: {
        ...layout(
          [win('W1', 'T', [1, 'CM', 1, 'CM', 1, 'CM', 1, 'CM'], { wlevel: 2 })],
          { variant: '%VAR1' },
        ),
        active: false,
      },
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM' }));
    expect(out.active).toBe(false);
    expect(out.pages[0].variant).toBe('%VAR1');
    expect(out.pages[0].printMode).toBe('');
    expect(out.pages[0].windows[0].level).toBe(2);
  });

  it('flattens the pages of two variants, each with its own LPI / CPI', async () => {
    const first = layout(
      [win('W1', 'T', [6, 'LN', 0, 'CM', 1, 'CM', 1, 'CM'])],
      {
        variant: 'A',
      },
    );
    const second = layout(
      [win('W1', 'T', [8, 'LN', 0, 'CM', 1, 'CM', 1, 'CM'])],
      { variant: 'B', lpi: 8, cpi: 12, pageFormat: 'LETTER' },
    );
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: {
        ...first,
        variants: [...first.variants, ...second.variants],
      },
    });
    const out = body(await run({ form_name: 'ZDEMO_FORM' }));
    expect(out.pages.map((p: any) => [p.variant, p.format, p.lpi])).toEqual([
      ['A', 'DINA4', 6],
      ['B', 'LETTER', 8],
    ]);
    expect(out.pages[0].windows[0].leftMm).toBe(25.4);
    expect(out.pages[1].windows[0].leftMm).toBe(25.4);
  });

  it('maps graphic and address nodes placed on the page', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([
        win('LOGO', 'G', [15, 'CM', 1, 'CM', 4, 'CM', 2, 'CM'], {
          wlevel: null,
        }),
        win('ADDR', 'A', [2, 'CM', 5, 'CM', 8, 'CM', 4, 'CM'], {
          wlevel: null,
        }),
      ]),
    });
    const [g, a] = body(await run({ form_name: 'ZDEMO_FORM' })).pages[0]
      .windows;
    expect([g.type, g.typeCode, g.leftMm, g.level]).toEqual([
      'GRAPHIC',
      'G',
      150,
      null,
    ]);
    expect([a.type, a.typeCode, a.widthMm]).toEqual(['ADDRESS', 'A', 80]);
  });

  it('keeps an unknown unit raw with a null mm value', async () => {
    mockDispatch.mockResolvedValue({
      subrc: 0,
      message: 'ok',
      result: layout([
        win('W1', 'T', [3, 'XX', 1, 'CM', ' ' as any, 'CM', 2, 'MM']),
      ]),
    });
    const w = body(await run({ form_name: 'ZDEMO_FORM' })).pages[0].windows[0];
    expect(w.left).toEqual({ value: 3, unit: 'XX' });
    expect(w.leftMm).toBeNull();
    expect(w.topMm).toBe(10);
    expect(w.width).toEqual({ value: null, unit: 'CM' });
    expect(w.widthMm).toBeNull();
    expect(w.heightMm).toBe(2);
  });

  it('does not give the install hint for an unrelated SOAP fault', async () => {
    mockDispatch.mockRejectedValue(
      new Error('SOAP Fault: Logon failed (user locked)'),
    );
    const res = await run({ form_name: 'ZDEMO_FORM' });
    expect(res.isError).toBe(true);
    const text = errorText(res);
    expect(text).toContain('SOAP Fault from SSF_LAYOUT');
    expect(text).toContain('Logon failed');
    expect(text).not.toContain(SSF_LAYOUT_INSTALL_HINT.substring(0, 40));
  });

  it('requires form_name', async () => {
    const res = await run({ form_name: '  ' });
    expect(res.isError).toBe(true);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
