/**
 * Unit tests for GetAdobeFormContent / RenderAdobeForm (lib/adobeForm):
 * dispatcher calls, files under the MCP output directory, errors.
 * The dispatcher is mocked; the XDP is a small invented template.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const callDispatch = jest.fn();
jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: (...args: unknown[]) => callDispatch(...args),
}));

import {
  checkMigrationNames,
  createAdobeFormFromSmartForm,
  FP_INSTALL_HINT,
  getAdobeFormContent,
  normalizeCorrection,
  normalizeFormName,
  prepareXdp,
  renderAdobeForm,
  renderAdobeXdp,
  summarizeXdp,
  translateFpError,
} from '../../lib/adobeForm';
import { checkToolAllowed } from '../../lib/readonlyGuard';

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
const XDP =
  '<?xml version="1.0"?><xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><template xmlns="http://www.xfa.org/schema/xfa-template/3.3/">' +
  '<subform name="data" layout="tb"><pageSet><pageArea name="Page1"><contentArea x="10mm" y="10mm" w="190mm" h="270mm"/>' +
  '<draw name="Title"><value><text>Order</text></value></draw></pageArea></pageSet>' +
  '<subform name="Head" layout="position"><field name="NAME1"><bind match="dataRef" ref="$.HEADER.NAME1"/></field></subform>' +
  '<subform name="Items" layout="table"><subform name="Row" layout="row"><field name="MATNR"><bind match="dataRef" ref="$.ITEMS.DATA[*].MATNR"/></field>' +
  '<field name="MATNR2"><bind match="dataRef" ref="$.ITEMS.DATA[*].MATNR"/></field></subform></subform>' +
  '<event activity="initialize"><script contentType="application/x-formcalc">1</script></event></subform></template></xdp:xdp>';

let outDir: string;
beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-test-'));
  process.env.MCP_OUTPUT_DIR = outDir;
});
afterAll(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});
beforeEach(() => callDispatch.mockReset());

describe('adobeForm — names, errors, XDP counts', () => {
  it('accepts form names, refuses anything a path or SAP could misread', () => {
    expect(normalizeFormName(' fp_test_00 ')).toBe('FP_TEST_00');
    expect(normalizeFormName('/NS/FORM_1')).toBe('/NS/FORM_1');
    for (const bad of ['', '../x', "Z'X", 'A'.repeat(31), 'Z X'])
      expect(() => normalizeFormName(bad)).toThrow(/form_name/);
  });

  it('maps a missing helper to the install hint and subrc 4 to not found', () => {
    expect(
      translateFpError(new Error('Unknown action: FP_CONTENT'), 'FP_CONTENT')
        .message,
    ).toContain(FP_INSTALL_HINT);
    expect(
      translateFpError(
        new Error('CALL_FUNCTION_NOT_FOUND: ZMCP_FP_CONTENT'),
        'FP_RENDER',
      ).message,
    ).toContain(FP_INSTALL_HINT);
    expect(
      translateFpError(
        new Error(
          'ZMCP_ADT_DISPATCH error (action=FP_CONTENT, subrc=4): no form',
        ),
        'FP_CONTENT',
      ).message,
    ).toMatch(/^Not found:/);
  });

  it('counts page areas, subforms by layout, fields, binds and scripts', () => {
    expect(summarizeXdp(XDP)).toEqual({
      pageAreas: 1,
      contentAreas: 1,
      subforms: 4,
      fields: 3,
      draws: 1,
      binds: ['$.HEADER.NAME1', '$.ITEMS.DATA[*].MATNR'],
      layouts: { tb: 1, position: 1, table: 1, row: 1 },
      scripts: 1,
    });
  });
});

describe('adobeForm — GetAdobeFormContent', () => {
  it('reads FORM, LAYOUT and INTERFACE and writes the files', async () => {
    callDispatch.mockImplementation(
      async (_c: unknown, action: string, p: any) => {
        expect(action).toBe('FP_CONTENT');
        if (p.part === 'FORM')
          return {
            result: {
              form: p.name,
              interface: 'FP_TEST_IF',
              formType: 'F',
              formTech: '',
              layoutType: 'S',
              xml: b64('<asx:abap/>'),
            },
          };
        if (p.part === 'LAYOUT')
          return { result: { form: p.name, xdp: b64(XDP) } };
        if (p.part === 'INTERFACE')
          return { result: { interface: p.name, xml: b64('<if/>') } };
        throw new Error('unexpected part');
      },
    );
    const r = await getAdobeFormContent({} as any, 'fp_test_00', {
      language: 'EN',
    });
    expect(callDispatch.mock.calls.map((c) => c[2])).toEqual([
      { part: 'FORM', name: 'FP_TEST_00', language: 'EN' },
      { part: 'LAYOUT', name: 'FP_TEST_00', language: 'EN' },
      { part: 'INTERFACE', name: 'FP_TEST_IF', language: 'EN' },
    ]);
    expect(r).toMatchObject({
      form: 'FP_TEST_00',
      interface: 'FP_TEST_IF',
      layoutType: 'S',
    });
    expect(r.summary.fields).toBe(3);
    expect(fs.readFileSync(r.files.layout, 'utf8')).toBe(XDP);
    expect(fs.readFileSync(r.files.formXml, 'utf8')).toBe('<asx:abap/>');
    expect(fs.readFileSync(r.files.interface as string, 'utf8')).toBe('<if/>');
    expect(
      JSON.parse(fs.readFileSync(r.files.form, 'utf8')).summary.binds,
    ).toHaveLength(2);
    for (const f of Object.values(r.files))
      expect(path.relative(outDir, f as string).startsWith('..')).toBe(false);
  });

  it("runs SAP's form check only with includeCheck and writes check.json", async () => {
    callDispatch.mockImplementation(
      async (_c: unknown, _action: string, p: any) => {
        if (p.part === 'FORM')
          return {
            result: {
              form: p.name,
              interface: '',
              formType: 'M',
              xml: b64('<x/>'),
            },
          };
        if (p.part === 'LAYOUT')
          return { result: { form: p.name, xdp: b64(XDP) } };
        if (p.part === 'CHECK')
          return {
            result: {
              form: p.name,
              messages: [
                {
                  msgty: 'E',
                  msgid: 'FPAPICHK',
                  msgno: '123',
                  text: 'Loop node: table not found',
                  type: 'NODE',
                  navcursor: 'X',
                },
              ],
            },
          };
        throw new Error('unexpected part');
      },
    );
    const plain = await getAdobeFormContent({} as any, 'ZSC4SAP_AFM_X', {});
    expect(plain.check).toBeUndefined();
    expect(callDispatch.mock.calls.some((c) => c[2].part === 'CHECK')).toBe(
      false,
    );
    const r = await getAdobeFormContent({} as any, 'ZSC4SAP_AFM_X', {
      includeCheck: true,
    });
    expect(r.check?.messages).toEqual([
      expect.objectContaining({
        msgty: 'E',
        text: 'Loop node: table not found',
      }),
    ]);
    expect(
      JSON.parse(fs.readFileSync(r.files.check as string, 'utf8')).messages,
    ).toHaveLength(1);
  });

  it('stops with the install hint when the helper is missing', async () => {
    callDispatch.mockRejectedValue(new Error('Unknown action: FP_CONTENT'));
    await expect(getAdobeFormContent({} as any, 'FP_TEST_00')).rejects.toThrow(
      /not installed on this system/,
    );
  });

  it('refuses a bad name before any SAP call', async () => {
    await expect(getAdobeFormContent({} as any, '../etc')).rejects.toThrow(
      /form_name/,
    );
    expect(callDispatch).not.toHaveBeenCalled();
  });
});

describe('adobeForm — RenderAdobeForm', () => {
  it('sends the values with upper-case components and writes the PDF', async () => {
    callDispatch.mockResolvedValue({
      result: {
        form: 'FP_TEST_00',
        fm: '/1BCDWB/SM00000042',
        pages: 2,
        pdf: b64('%PDF-1.6 test'),
      },
    });
    const r = await renderAdobeForm(
      {} as any,
      'FP_TEST_00',
      { is_header: { name1: 'Sample' }, it_items: [{ matnr: 'A1' }] },
      'EN',
    );
    const [, action, params] = callDispatch.mock.calls[0];
    expect(action).toBe('FP_RENDER');
    expect(JSON.parse(params.params)).toEqual([
      { name: 'IS_HEADER', json: '{"NAME1":"Sample"}' },
      { name: 'IT_ITEMS', json: '[{"MATNR":"A1"}]' },
    ]);
    expect(r).toMatchObject({ fm: '/1BCDWB/SM00000042', pages: 2 });
    expect(fs.readFileSync(r.files.pdf, 'latin1').startsWith('%PDF')).toBe(
      true,
    );
  });

  it('asks for the data XML with get_xml and writes it next to the PDF', async () => {
    callDispatch.mockResolvedValue({
      result: {
        fm: '/1BCDWB/SM1',
        pages: 1,
        pdf: b64('%PDF-1.6 x'),
        xml: b64('<data><A>1</A></data>'),
      },
    });
    const r = await renderAdobeForm(
      {} as any,
      'FP_TEST_00',
      { a: 1, $GETXML: true },
      undefined,
      true,
    );
    const sent = JSON.parse(callDispatch.mock.calls[0][2].params);
    expect(sent).toEqual([
      { name: 'A', json: '1' },
      { name: '$GETXML', json: 'true' },
    ]);
    expect(fs.readFileSync(r.files.dataXml as string, 'utf8')).toBe(
      '<data><A>1</A></data>',
    );
    expect(r.files.dataXml).toMatch(/fp_test_00\.sap\.data\.xml$/);
    callDispatch.mockResolvedValue({
      result: { pdf: b64('%PDF-1.6 x'), xmlError: 'ADS returned no data XML' },
    });
    const r2 = await renderAdobeForm(
      {} as any,
      'FP_TEST_00',
      {},
      undefined,
      true,
    );
    expect(r2.xmlError).toBe('ADS returned no data XML');
    expect(r2.files.dataXml).toBeUndefined();
    callDispatch.mockResolvedValue({ result: { pdf: b64('%PDF-1.6 x') } });
    const r3 = await renderAdobeForm({} as any, 'FP_TEST_00', {});
    expect(JSON.parse(callDispatch.mock.calls[2][2].params)).toEqual([]);
    expect(r3.xmlError).toBeUndefined();
  });

  it('refuses a non-PDF answer, a missing PDF and oversized values', async () => {
    callDispatch.mockResolvedValue({ result: { pdf: b64('<html>') } });
    await expect(renderAdobeForm({} as any, 'FP_TEST_00', {})).rejects.toThrow(
      /not a PDF/,
    );
    callDispatch.mockResolvedValue({ result: {}, message: 'no ADS' });
    await expect(renderAdobeForm({} as any, 'FP_TEST_00', {})).rejects.toThrow(
      /no PDF/,
    );
    callDispatch.mockReset();
    await expect(
      renderAdobeForm({} as any, 'FP_TEST_00', { X: 'y'.repeat(200001) }),
    ).rejects.toThrow(/200 000/);
    expect(callDispatch).not.toHaveBeenCalled();
  });
});

describe('adobeForm — CreateAdobeFormFromSmartForm', () => {
  it('checks names before any SAP call', async () => {
    expect(
      checkMigrationNames(
        'sf_example_01',
        'zsc4sap_afm_ex01',
        'ZSC4SAP_AFM_EX01_IF',
      ),
    ).toEqual({
      source: 'SF_EXAMPLE_01',
      form: 'ZSC4SAP_AFM_EX01',
      iface: 'ZSC4SAP_AFM_EX01_IF',
    });
    for (const [s, f, i] of [
      ['ZMY_FORM', 'ZSC4SAP_AFM_A', 'ZSC4SAP_AFM_B'],
      ['YFORM', 'ZSC4SAP_AFM_A', 'ZSC4SAP_AFM_B'],
      ['/ABC/X', 'ZSC4SAP_AFM_A', 'ZSC4SAP_AFM_B'],
      ['SF_EXAMPLE_01', 'ZOTHER', 'ZSC4SAP_AFM_B'],
      ['SF_EXAMPLE_01', 'ZSC4SAP_AFM_A', 'ZSC4SAP_AFI_B'],
      ['SF_EXAMPLE_01', 'ZSC4SAP_AFM_' + 'X'.repeat(20), 'ZSC4SAP_AFM_B'],
    ]) {
      await expect(
        createAdobeFormFromSmartForm({} as any, s, f, i),
      ).rejects.toThrow(/source|form_name|interface_name/);
    }
    expect(callDispatch).not.toHaveBeenCalled();
  });

  it('sends FP_MIGRATE with the FULL preset and writes the result with the log', async () => {
    callDispatch.mockResolvedValue({
      result: {
        options: { interface: 'X' },
        raised: false,
        saved: ['SFPI ZSC4SAP_AFM_IF', 'SFPF ZSC4SAP_AFM_F'],
        left: [],
        active: ['SFPI ZSC4SAP_AFM_IF', 'SFPF ZSC4SAP_AFM_F'],
        activation: '',
        log: [{ type: 'W', text: 'Node X: field Y not supported' }],
        renamed: [
          {
            path: 'MAIN.T.GS[*].CARRID',
            from: 'CARRID',
            to: 'CARRID_2',
            type: 4,
          },
        ],
        cacheInfo:
          '2026-11-17T08:00:00Z$0f0e0d0c-aaaa-bbbb-cccc-000000000001$0$0$v1.0',
      },
    });
    const r = await createAdobeFormFromSmartForm(
      {} as any,
      'SF_EXAMPLE_01',
      'ZSC4SAP_AFM_F',
      'ZSC4SAP_AFM_IF',
    );
    const [, action, params] = callDispatch.mock.calls[0];
    expect(action).toBe('FP_MIGRATE');
    expect(params).toEqual({
      source: 'SF_EXAMPLE_01',
      form: 'ZSC4SAP_AFM_F',
      interface: 'ZSC4SAP_AFM_IF',
      preset: 'FULL',
    });
    expect(r).toMatchObject({
      raised: false,
      complete: true,
      renamed: [expect.objectContaining({ from: 'CARRID', to: 'CARRID_2' })],
      cacheInfo: expect.stringMatching(/^2026-11-17T/),
      active: ['SFPI ZSC4SAP_AFM_IF', 'SFPF ZSC4SAP_AFM_F'],
      log: [{ type: 'W' }],
    });
    expect(
      JSON.parse(fs.readFileSync(r.files.result, 'utf8')).log,
    ).toHaveLength(1);
  });

  it('passes sender_country only when given, refuses a bad one, returns adjusted', async () => {
    callDispatch.mockResolvedValue({
      result: {
        raised: false,
        saved: [],
        left: [],
        active: ['SFPI ZSC4SAP_AFM_IF', 'SFPF ZSC4SAP_AFM_F'],
        adjusted: [
          {
            path: 'FIRST.ADDR',
            attribute: 'SENDERCOUNTRY',
            from: '',
            to: 'DE',
          },
        ],
        log: [],
      },
    });
    const r = await createAdobeFormFromSmartForm(
      {} as any,
      'SF_EXAMPLE_01',
      'ZSC4SAP_AFM_F',
      'ZSC4SAP_AFM_IF',
      ' de ',
    );
    expect(callDispatch.mock.calls[0][2]).toMatchObject({
      sender_country: 'DE',
    });
    expect(r.adjusted).toEqual([expect.objectContaining({ to: 'DE' })]);
    callDispatch.mockClear();
    await createAdobeFormFromSmartForm(
      {} as any,
      'SF_EXAMPLE_01',
      'ZSC4SAP_AFM_F',
      'ZSC4SAP_AFM_IF',
    );
    expect(callDispatch.mock.calls[0][2]).not.toHaveProperty('sender_country');
    await expect(
      createAdobeFormFromSmartForm(
        {} as any,
        'SF_EXAMPLE_01',
        'ZSC4SAP_AFM_F',
        'ZSC4SAP_AFM_IF',
        'DE"; x',
      ),
    ).rejects.toThrow(/sender_country/);
  });

  it('flags a migration that is saved but not fully active', async () => {
    callDispatch.mockResolvedValue({
      result: {
        raised: false,
        saved: ['SFPI ZSC4SAP_AFM_IF', 'SFPF ZSC4SAP_AFM_F'],
        left: [],
        active: ['SFPI ZSC4SAP_AFM_IF'],
        activation: 'form activation rc 4',
        log: [],
      },
      message:
        'FP_MIGRATE: saved but NOT fully active (active: SFPI ZSC4SAP_AFM_IF)',
    });
    const r = await createAdobeFormFromSmartForm(
      {} as any,
      'SF_EXAMPLE_01',
      'ZSC4SAP_AFM_F',
      'ZSC4SAP_AFM_IF',
    );
    expect(r.complete).toBe(false);
    expect(r.message).toMatch(/NOT fully active/);
    expect(JSON.parse(fs.readFileSync(r.files.result, 'utf8')).complete).toBe(
      false,
    );
  });

  it('passes the objects left behind on a raise through in the error', async () => {
    callDispatch.mockRejectedValue(
      new Error(
        "ZMCP_ADT_DISPATCH error (action=FP_MIGRATE, subrc=8): FP_MIGRATE: SAP's migration raised: X - left behind: SFPI ZSC4SAP_AFM_IF (delete only with the user's OK)",
      ),
    );
    await expect(
      createAdobeFormFromSmartForm(
        {} as any,
        'SF_EXAMPLE_01',
        'ZSC4SAP_AFM_F',
        'ZSC4SAP_AFM_IF',
      ),
    ).rejects.toThrow(/left behind: SFPI ZSC4SAP_AFM_IF/);
  });

  it('turns a missing helper into the install hint', async () => {
    callDispatch.mockRejectedValue(new Error('Unknown action: FP_MIGRATE'));
    await expect(
      createAdobeFormFromSmartForm(
        {} as any,
        'SF_EXAMPLE_01',
        'ZSC4SAP_AFM_F',
        'ZSC4SAP_AFM_IF',
      ),
    ).rejects.toThrow(/ZMCP_FP_MIGRATE/);
  });

  it('is a write: refused on QA and PRD by the server guard', () => {
    expect(checkToolAllowed('CreateAdobeFormFromSmartForm', 'DEV')).toBeNull();
    expect(checkToolAllowed('CreateAdobeFormFromSmartForm', 'QA')).toMatch(
      /mutates/,
    );
    expect(checkToolAllowed('CreateAdobeFormFromSmartForm', 'PRD')).toMatch(
      /mutates/,
    );
  });
});

describe('adobeForm — RenderAdobeXdp', () => {
  it('sends XDP + XML as RENDER_XDP and writes the PDF and the trace', async () => {
    callDispatch.mockResolvedValue({
      result: {
        form: 'ZF_CINE_TICKET',
        pages: 1,
        pdf: b64('%PDF-1.7 x'),
        trace: 'ok',
      },
    });
    const r = await renderAdobeXdp(
      {} as any,
      'zf_cine_ticket',
      Buffer.from('<xdp/>'),
      Buffer.from('<Form/>'),
      'de_DE',
    );
    const [, action, p] = callDispatch.mock.calls[0];
    expect(action).toBe('FP_CONTENT');
    expect(p.part).toBe('RENDER_XDP');
    expect(p.name).toBe('ZF_CINE_TICKET');
    expect(JSON.parse(p.params)).toEqual({
      xdp: b64('<xdp/>'),
      xml: b64('<Form/>'),
      locale: 'de_DE',
      embedFonts: false,
    });
    expect(fs.readFileSync(r.files.pdf, 'latin1').startsWith('%PDF')).toBe(
      true,
    );
    expect(fs.readFileSync(r.files.trace as string, 'utf8')).toBe('ok');
  });

  it('refuses other labels, bad locales and a non-PDF answer before / after the call', async () => {
    await expect(
      renderAdobeXdp(
        {} as any,
        'FP_TEST_00',
        Buffer.from('a'),
        Buffer.from('b'),
      ),
    ).rejects.toThrow(/form_name/);
    await expect(
      renderAdobeXdp(
        {} as any,
        'ZF_CINE_TICKET',
        Buffer.from('a'),
        Buffer.from('b'),
        'en-US',
      ),
    ).rejects.toThrow(/locale/);
    expect(callDispatch).not.toHaveBeenCalled();
    callDispatch.mockResolvedValue({ result: { pdf: b64('nope') } });
    await expect(
      renderAdobeXdp(
        {} as any,
        'ZSC4SAP_T1',
        Buffer.from('a'),
        Buffer.from('b'),
      ),
    ).rejects.toThrow(/not a PDF/);
  });

  it('is read-only for the server guard (allowed on QA / PRD)', () => {
    expect(checkToolAllowed('RenderAdobeXdp', 'PRD')).toBeNull();
  });

  it('takes out the designer data connection and refuses anything ADS could fetch', async () => {
    const withCs = Buffer.from(
      '<xdp><template><image contentType="image/png">AAAA</image></template><config><xsl><uri/></xsl></config>' +
        '<connectionSet xmlns="x"><xmlConnection><uri>.\\data.xml</uri></xmlConnection></connectionSet></xdp>',
    );
    const p = prepareXdp(withCs);
    expect(p.removed).toEqual(['connectionSet']);
    expect(p.xdp.toString()).not.toMatch(/connectionSet|data\.xml/);
    for (const bad of [
      '<image href="http://evil/x.png"/>',
      '<image href="file:///c:/x.png"/>',
      "<img src='\\\\host\\share\\x.png'/>",
      '<image href="/sap/bc/fp/graphics/x.bmp"/>',
      '<div style="background: url(http://x)"/>',
      '<xfa:uri>http://x/data.xml</xfa:uri>',
      '<submit target="http://x"/>',
      '<script>xfa.host.gotoURL("http://x")</script>',
      '<connectionSet><uri>x</uri>',
      '<subform usehref="frag.xdp#som($template.x)"/>',
      '<script contentType="application/x-formcalc">Get("http://x")</script>',
      '<script contentType="application/x-formcalc">post ("http://x", d)</script>',
    ])
      expect(() => prepareXdp(Buffer.from(`<xdp>${bad}</xdp>`))).toThrow(
        /refused/,
      );
    expect(() =>
      prepareXdp(
        Buffer.from(
          '<xdp><draw><value><exData><span xfa:embed="#som"/></exData></value></draw></xdp>',
        ),
      ),
    ).not.toThrow();
    callDispatch.mockResolvedValue({
      result: { pages: 1, pdf: b64('%PDF-1.7') },
    });
    const r = await renderAdobeXdp(
      {} as any,
      'ZSC4SAP_T2',
      withCs,
      Buffer.from('<Form/>'),
    );
    expect(r.removed).toEqual(['connectionSet']);
    const sent = Buffer.from(
      JSON.parse(callDispatch.mock.calls[0][2].params).xdp,
      'base64',
    ).toString();
    expect(sent).not.toMatch(/connectionSet/);
    expect(() =>
      prepareXdp(
        Buffer.from(
          '<xdp><subform usehref="#som($template.x)"/><script>this.getAttribute("x")</script></xdp>',
        ),
      ),
    ).not.toThrow();
  });

  it('keeps the ADS trace when ADS fails', async () => {
    callDispatch.mockResolvedValue({
      result: {
        pages: 0,
        pdf: '',
        error: 'ADS: layout error',
        trace: 'trace line 1',
      },
    });
    await expect(
      renderAdobeXdp(
        {} as any,
        'ZSC4SAP_T3',
        Buffer.from('<xdp/>'),
        Buffer.from('<Form/>'),
      ),
    ).rejects.toThrow(
      /ADS error: ADS: layout error \(ADS trace: .*zsc4sap_t3\.xdp\.ads-trace\.txt\)/,
    );
    const f = path.join(
      outDir,
      'adobe',
      'zsc4sap_t3',
      'zsc4sap_t3.xdp.ads-trace.txt',
    );
    expect(fs.readFileSync(f, 'utf8')).toBe('trace line 1');
  });
});

describe('adobeForm — migration layout correction', () => {
  const spec = {
    version: 1,
    source: 'SF_EXAMPLE_01',
    ops: [
      {
        op: 'layout',
        target: { path: 'SF_EXAMPLE_01.MAIN' },
        value: 'tb',
        rule: 'R1',
      },
      {
        op: 'geometry',
        target: { protoId: 'FIRST_ADDRESS' },
        y: '43.61mm',
        rule: 'R2',
        evidence: '4 texts dy 1.39',
      },
      {
        op: 'margin',
        target: { protoId: 'FIRST_INFO' },
        topInset: 2.33,
        rule: 'R2',
      },
      {
        op: 'picture',
        target: { protoId: 'FIRST_INFO', path: 'INFO_TEXT.SY.DATUM' },
        format: 'date{MM/DD/YYYY}',
      },
      {
        op: 'xhtml',
        target: { xliffId: 'N1039-4' },
        div: 0,
        css: { 'Line-Height': '12pt', 'margin-left': '2mm' },
      },
    ],
    notes: [],
  };

  it('flattens spec v1 for the FM and ignores unknown keys', () => {
    const n = normalizeCorrection(spec);
    expect(n).toMatchObject({ ops: 5, strict: false });
    const j = JSON.parse(n.json);
    expect(j.strict).toBe(false);
    expect(j.ops[0]).toEqual({
      op: 'layout',
      path: 'SF_EXAMPLE_01.MAIN',
      value: 'tb',
      rule: 'R1',
    });
    expect(j.ops[1]).toEqual({
      op: 'geometry',
      protoid: 'FIRST_ADDRESS',
      y: '43.61mm',
      rule: 'R2',
    });
    expect(j.ops[2].topinset).toBe('2.33');
    expect(j.ops[3]).toMatchObject({
      protoid: 'FIRST_INFO',
      path: 'INFO_TEXT.SY.DATUM',
      format: 'date{MM/DD/YYYY}',
    });
    expect(j.ops[4]).toMatchObject({
      xliffid: 'N1039-4',
      div: '0',
      css: 'line-height:12pt;margin-left:2mm',
    });
    expect(normalizeCorrection({ ...spec, strict: true }).strict).toBe(true);
    expect(normalizeCorrection({ ...spec, strict: true }, false).strict).toBe(
      false,
    );
  });

  it('refuses bad specs before any SAP call', () => {
    const bad = (s: unknown) =>
      expect(() => normalizeCorrection(s)).toThrow(/correction/);
    bad({ ops: [] });
    bad({ version: 2, ops: spec.ops });
    bad({ version: 1, ops: [] });
    bad({ version: 1, ops: Array.from({ length: 501 }, () => spec.ops[0]) });
    bad({ version: 1, ops: [{ op: 'script', target: { path: 'A' } }] });
    bad({ version: 1, ops: [{ op: 'layout', value: 'tb' }] });
    bad({
      version: 1,
      ops: [{ op: 'layout', target: { path: 'A' }, value: { x: 1 } }],
    });
    bad({
      version: 1,
      ops: [
        {
          op: 'xhtml',
          target: { path: 'A' },
          div: 0,
          css: { background: 'red' },
        },
      ],
    });
    bad({
      version: 1,
      ops: [
        {
          op: 'xhtml',
          target: { path: 'A' },
          div: 0,
          css: { 'font-family': 'x;y:url(z)' },
        },
      ],
    });
  });

  it('sends the correction with FP_MIGRATE and returns the per-op report', async () => {
    callDispatch.mockResolvedValue({
      result: {
        source: 'SF_EXAMPLE_01',
        form: 'ZSC4SAP_AFM_C1',
        interface: 'ZSC4SAP_AFM_C1I',
        options: {},
        raised: false,
        saved: ['SFPI ZSC4SAP_AFM_C1I', 'SFPF ZSC4SAP_AFM_C1'],
        left: [],
        active: ['SFPI ZSC4SAP_AFM_C1I', 'SFPF ZSC4SAP_AFM_C1'],
        renamed: [],
        adjusted: [],
        log: [],
        correction: {
          strict: false,
          ops: 2,
          applied: 1,
          notFound: 1,
          ambiguous: 0,
          refused: 0,
          partial: true,
          warnings: [],
          results: [
            { i: 0, op: 'layout', rule: 'R1', status: 'applied', detail: '' },
            {
              i: 1,
              op: 'geometry',
              rule: 'R2',
              status: 'not_found',
              detail: '',
            },
          ],
        },
      },
    });
    const c = normalizeCorrection({ version: 1, ops: spec.ops.slice(0, 2) });
    const r = await createAdobeFormFromSmartForm(
      {} as any,
      'SF_EXAMPLE_01',
      'ZSC4SAP_AFM_C1',
      'ZSC4SAP_AFM_C1I',
      undefined,
      c,
    );
    const [, action, params] = callDispatch.mock.calls[0];
    expect(action).toBe('FP_MIGRATE');
    expect(JSON.parse(params.correction).ops).toHaveLength(2);
    expect(r.correction).toMatchObject({
      partial: true,
      applied: 1,
      notFound: 1,
    });
    expect(r.complete).toBe(true);
  });
});
