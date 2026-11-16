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
  FP_INSTALL_HINT,
  getAdobeFormContent,
  normalizeFormName,
  renderAdobeForm,
  summarizeXdp,
  translateFpError,
} from '../../lib/adobeForm';

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
