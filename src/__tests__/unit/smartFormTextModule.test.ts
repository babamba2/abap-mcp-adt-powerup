/**
 * GetSmartFormContent and text modules (TTYPE R): the referenced module is read by REF_NAME through the FORM part
 * (its own Form Builder XML, FORMTYPE T), never as an SO10 text by the TKEY Form Builder may keep from an earlier
 * include text; an empty text falls back to the module's master language. Dispatcher mocked, names invented.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const callDispatch = jest.fn();
jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: (...args: unknown[]) => callDispatch(...args),
  getBackend: () => 'soap',
}));

import { getSmartFormContent } from '../../lib/smartFormContent';

const b64 = (s: string) => Buffer.from(s).toString('base64');
const cap = (t: string) => `<CAPTION>${t}</CAPTION>`;
const SF = (body: string, head = '') =>
  `<?xml version="1.0" encoding="utf-8"?><sf:SMARTFORM xmlns:sf="urn:sap-com:SmartForms:2000:internal-structure" xmlns="urn:sap-com:sdixml-ifr:2000" sf:language="EN">` +
  `<HEADER>${head}</HEADER><sf:VARHEADER><sf:item><PAGEFORMAT>DINA4</PAGEFORMAT><STDSTYLE>ZTEST_STYLE</STDSTYLE><sf:PAGETREE>${body}</sf:PAGETREE></sf:item></sf:VARHEADER></sf:SMARTFORM>`;
const FORM = SF(
  `<sf:NODE><NODETYPE>RP</NODETYPE><sf:SUCC><sf:item><sf:NODE><NODETYPE>PA</NODETYPE><sf:OBJ><sf:PAGE><NAME><INAME>%PAGE1</INAME></NAME>${cap('P')}</sf:PAGE></sf:OBJ><sf:SUCC>` +
    `<sf:item><sf:NODE><NODETYPE>WI</NODETYPE><sf:OBJ><sf:WINDOW><NAME><INAME>FOOT</INAME></NAME>${cap('F')}<WTYPE>S</WTYPE><sf:PROC_CTRL>` +
    `<sf:NODE><NODETYPE>TI</NODETYPE><sf:OBJ><sf:TEXT><NAME><INAME>FOOTER_INCL</INAME></NAME>${cap('Footer')}<TTYPE>R</TTYPE>` +
    `<STYLE_NAME>ZTEST_STYLE</STYLE_NAME><REF_NAME>ZTEST_TM_FOOTER</REF_NAME><TKEY><OBJECT>TEXT</OBJECT><NAME>ZTEST_OLD_SO10</NAME><ID>ADRS</ID></TKEY>` +
    `</sf:TEXT></sf:OBJ><sf:SUCC/></sf:NODE></sf:PROC_CTRL></sf:WINDOW></sf:OBJ><sf:SUCC/></sf:NODE></sf:item></sf:SUCC></sf:NODE></sf:item></sf:SUCC></sf:NODE>`,
  '<FORMNAME>ZTEST_FORM</FORMNAME>',
);
const MODULE = (lines: string) =>
  SF(
    `<sf:NODE><NODETYPE>TI</NODETYPE><sf:OBJ><sf:TEXT><NAME><INAME>%TEXT1</INAME></NAME>${cap('T')}<TTYPE>R</TTYPE><TEXT>${lines}</TEXT>` +
      `<STYLE_NAME>ZTEST_TM_STYLE</STYLE_NAME></sf:TEXT></sf:OBJ></sf:NODE>`,
    '<FORMNAME>ZTEST_TM_FOOTER</FORMNAME><FORMTYPE>T</FORMTYPE><MASTERLANG>D</MASTERLANG>',
  );

let outDir: string;
beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-tm-'));
  process.env.MCP_OUTPUT_DIR = outDir;
});
afterAll(() => fs.rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => callDispatch.mockReset());

const dispatch = (moduleE: string, moduleD: string) =>
  callDispatch.mockImplementation(
    async (_c: unknown, _a: string, p: Record<string, string>) => {
      if (p.part === 'FORM' && p.form_name === 'ZTEST_FORM')
        return { result: { xml: b64(FORM), language: 'E' } };
      if (p.part === 'FORM' && p.form_name === 'ZTEST_TM_FOOTER')
        return {
          result: {
            xml: b64(MODULE(p.language === 'D' ? moduleD : moduleE)),
            language: p.language || 'E',
          },
        };
      throw new Error(
        `unexpected part ${p.part} ${p.form_name ?? p.name ?? ''}`,
      );
    },
  );

describe('GetSmartFormContent: text modules', () => {
  it('reads the module by REF_NAME (FORM part), never the stale TKEY as an SO10 text', async () => {
    dispatch(
      '<item><TDFORMAT>FT</TDFORMAT><TDLINE>Sample Street 1</TDLINE></item>',
      '',
    );
    const c = await getSmartFormContent({} as never, 'ZTEST_FORM', {
      includeStyles: false,
      includeGraphics: false,
    } as never);
    expect(c.includeTexts).toEqual([
      {
        object: 'TEXTMODULE',
        name: 'ZTEST_TM_FOOTER',
        id: '',
        language: 'E',
        lines: [{ format: 'FT', text: 'Sample Street 1' }],
        style: 'ZTEST_TM_STYLE',
      },
    ]);
    const parts = callDispatch.mock.calls.map((x) => x[2]);
    expect(parts.some((p) => p.part === 'STDTEXT')).toBe(false);
    expect(
      parts.some((p) => JSON.stringify(p).includes('ZTEST_OLD_SO10')),
    ).toBe(false);
  });

  it('takes an empty module text from the master language', async () => {
    dispatch(
      '',
      '<item><TDFORMAT>FT</TDFORMAT><TDLINE>Musterstrasse 1</TDLINE></item>',
    );
    const c = await getSmartFormContent({} as never, 'ZTEST_FORM', {
      includeStyles: false,
      includeGraphics: false,
    } as never);
    expect(c.includeTexts[0].lines).toEqual([
      { format: 'FT', text: 'Musterstrasse 1' },
    ]);
  });
});
