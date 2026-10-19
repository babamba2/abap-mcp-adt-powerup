/**
 * Unit tests for GetSmartFormContent: parsing of the Form Builder XML
 * (FB_CONVERT_FORM_TO_XML). The fixture follows the shape of a real form
 * (sf: namespace, <NAME><INAME>, WINDOW/PROC_CTRL, RC root container,
 * cell position in OUTATTR, COND/CONDITION/OCOND); names are invented.
 */

import {
  hasSymbol,
  parseSmartFormXml,
  symbolsOf,
  translateSmartFormContentError,
} from '../../lib/smartFormContent';

const cap = (t: string) =>
  `<CAPTION>${t}</CAPTION><T_CAPTION><item><LANGU>E</LANGU><CAPTION>${t}</CAPTION></item></T_CAPTION>`;

const outattr = (inner: string) =>
  `<sf:OUTATTR><sf:OUTATTR><NAME><INAME>%OA</INAME></NAME>${inner}</sf:OUTATTR></sf:OUTATTR>`;

const winPos = (l: string, t: string, w: string, h: string) =>
  outattr(
    `<U_WFRAME>PT</U_WFRAME><WLEFT>${l}</WLEFT><U_WLEFT>CM</U_WLEFT><WWIDTH>${w}</WWIDTH><U_WWIDTH>CM</U_WWIDTH>` +
      `<WTOP>${t}</WTOP><U_WTOP>CM</U_WTOP><WHEIGHT>${h}</WHEIGHT><U_WHEIGHT>CM</U_WHEIGHT>`,
  );

const text = (name: string, fmt: string, line: string, cell = '') =>
  `<sf:item><sf:NODE><NODETYPE>TI</NODETYPE><sf:OBJ><sf:TEXT><NAME><INAME>${name}</INAME></NAME>${cap(name)}` +
  `<APPMODE>P</APPMODE><TEXT><item><TDFORMAT>${fmt}</TDFORMAT><TDLINE>${line}</TDLINE></item></TEXT>` +
  `<STYLE_NAME>ZTEST_STYLE</STYLE_NAME></sf:TEXT></sf:OBJ>` +
  (cell
    ? outattr(
        `<T_LINENR>${cell.split('/')[0]}</T_LINENR><T_CELLNR>${cell.split('/')[1]}</T_CELLNR><U_WLEFT>CM</U_WLEFT>`,
      )
    : '') +
  `<sf:SUCC/></sf:NODE></sf:item>`;

const cond = (flag: string) =>
  `<sf:COND><sf:CONDITION><NAME><INAME>%COND1</INAME></NAME>${cap('Alt')}<OCOND><${flag}>X</${flag}></OCOND></sf:CONDITION></sf:COND>`;

const graphic = (name: string, key: string, btype: string) =>
  `<sf:NODE><NODETYPE>GR</NODETYPE><sf:OBJ><sf:GRAPHIC><NAME><INAME>${name}</INAME></NAME>${cap(name)}` +
  `<GTYPE>B</GTYPE><GKEYBDS><OBJECT>GRAPHICS</OBJECT><NAME>${key}</NAME><ID>BMAP</ID><BTYPE>${btype}</BTYPE></GKEYBDS>` +
  `</sf:GRAPHIC></sf:OBJ><sf:SUCC/></sf:NODE>`;

const window = (
  id: string,
  name: string,
  wtype: string,
  procCtrl: string,
  pos: string,
  extra = '',
) =>
  `<sf:item><sf:NODE><NODETYPE>WI</NODETYPE><sf:OBJ><sf:WINDOW ID="${id} "><NAME><INAME>${name}</INAME></NAME>${cap(name)}` +
  `<WTYPE>${wtype}</WTYPE><sf:PROC_CTRL>${procCtrl}</sf:PROC_CTRL></sf:WINDOW></sf:OBJ>${pos}${extra}<sf:SUCC/></sf:NODE></sf:item>`;

const rc = (id: string, items: string) =>
  `<sf:NODE ID="${id} "><NODETYPE>RC</NODETYPE><sf:SUCC>${items}</sf:SUCC></sf:NODE>`;

const template =
  `<sf:item><sf:NODE><NODETYPE>SE</NODETYPE><sf:OBJ><sf:SECTION><NAME><INAME>%TEMPLATE1</INAME></NAME>${cap('Header')}` +
  `<SECTTYPE>S</SECTTYPE><WIDTH>19.00</WIDTH><U_WIDTH>CM</U_WIDTH>` +
  `<STATLINES><item><NAME>%C1</NAME><LINEFROM>001</LINEFROM><LINETO>002</LINETO><LHEIGHT>6.00</LHEIGHT><U_LHEIGHT>MM</U_LHEIGHT><SHADING>000</SHADING></item></STATLINES>` +
  `<CELLS><item><NAME>%C1</NAME><COLUMNNR>001</COLUMNNR><CWIDTH>3.00</CWIDTH><U_CWIDTH>CM</U_CWIDTH><BORDERS><item><IDX>001</IDX>` +
  `<LLEFT>15.00</LLEFT><LLEFT_U>TW</LLEFT_U><LTOP>0.00</LTOP><LTOP_U>MM</LTOP_U><LRIGHT>15.00</LRIGHT><LRIGHT_U>TW</LRIGHT_U><LBOTTOM>15.00</LBOTTOM><LBOTTOM_U>TW</LBOTTOM_U>` +
  `<FILLCOLOR><RED>212</RED><GREEN>212</GREEN><BLUE>212</BLUE><USED>X</USED></FILLCOLOR>` +
  `<CLEFT><RED>0</RED><GREEN>0</GREEN><BLUE>0</BLUE><USED>X</USED></CLEFT><CTOP><USED>X</USED></CTOP>` +
  `<CRIGHT><RED>0</RED></CRIGHT><CBOTTOM><USED>X</USED></CBOTTOM></item></BORDERS></item>` +
  // shading 0 % → no fill although a colour is set; 50 % → colour blended toward white
  `<item><NAME>%C1</NAME><COLUMNNR>002</COLUMNNR><CWIDTH>6.50</CWIDTH><U_CWIDTH>CM</U_CWIDTH><BORDERS><item><IDX>001</IDX><INTENSITY>000</INTENSITY>` +
  `<FILLCOLOR><RED>000</RED><GREEN>000</GREEN><BLUE>000</BLUE><USED>X</USED></FILLCOLOR></item></BORDERS></item>` +
  `<item><NAME>%C1</NAME><COLUMNNR>003</COLUMNNR><CWIDTH>3.00</CWIDTH><U_CWIDTH>CM</U_CWIDTH><BORDERS><item><IDX>001</IDX><INTENSITY>050</INTENSITY>` +
  `<FILLCOLOR><RED>000</RED><GREEN>000</GREEN><BLUE>255</BLUE><USED>X</USED></FILLCOLOR></item></BORDERS></item></CELLS>` +
  `</sf:SECTION></sf:OBJ>${cond('FPAGE')}<sf:SUCC>` +
  text('%TEXT7', 'AA', 'Buyer', '001/001') +
  text('%TEXT9', 'A8', '&amp;HEADER-NAME1&amp;', '002/001') +
  `</sf:SUCC></sf:NODE></sf:item>`;

const XML =
  `<?xml version="1.0" encoding="utf-8"?><sf:SMARTFORM xmlns:sf="urn:sap-com:SmartForms:2000:internal-structure" xmlns="urn:sap-com:sdixml-ifr:2000" sf:language="EN">` +
  `<HEADER><FORMNAME>ZTEST_FORM</FORMNAME></HEADER>` +
  `<INTERFACE><item><IOTYPE>I</IOTYPE><NAME>CONTROL_PARAMETERS</NAME><TYPING>TYPE</TYPING><TYPENAME>SSFCTRLOP</TYPENAME><STANDARD>X</STANDARD></item>` +
  `<item><IOTYPE>I</IOTYPE><NAME>HEADER</NAME><TYPING>TYPE</TYPING><TYPENAME>ZTEST_S_HEAD</TYPENAME></item>` +
  `<item><IOTYPE>X</IOTYPE><NAME>FORMATTING_ERROR</NAME><STANDARD>X</STANDARD></item>` +
  `<item><IOTYPE>T</IOTYPE><NAME>ITEM</NAME><TYPING>LIKE</TYPING><TYPENAME>ZTEST_S_ITEM</TYPENAME></item></INTERFACE>` +
  `<GDATA><item><NAME>GS_ITEM</NAME><TYPING>TYPE</TYPING><TYPENAME>ZTEST_S_ITEM</TYPENAME></item></GDATA>` +
  `<sf:VARHEADER><sf:item><PAGEFORMAT>DINA4</PAGEFORMAT><STDSTYLE>ZTEST_STYLE</STDSTYLE><CPI>10.00</CPI><LPI>6.00</LPI>` +
  `<sf:PAGETREE><sf:NODE><NODETYPE>RP</NODETYPE><sf:SUCC><sf:item><sf:NODE><NODETYPE>PA</NODETYPE><sf:OBJ><sf:PAGE>` +
  `<NAME><INAME>%PAGE1</INAME></NAME>${cap('First')}<NEXTPAGE><INAME>%PAGE1</INAME></NEXTPAGE><PAGEORTN>P</PAGEORTN></sf:PAGE></sf:OBJ>` +
  `<sf:SUCC>` +
  window(
    '620',
    '%GRAPHIC1',
    'G',
    graphic('%GRAPHIC1', 'ZTEST_LOGO', 'BCOL'),
    winPos('1.00', '0.80', '5.51', '0.74'),
  ) +
  window(
    '828',
    '%WINDOW1',
    'T',
    rc('852', text('%TEXT1', 'BJ', '&lt;AA&gt;PURCHASE ORDER&lt;/&gt;')),
    winPos('1.00', '1.50', '19.00', '1.00'),
  ) +
  window(
    '900',
    'MAIN',
    'M',
    rc('910', template),
    winPos('1.00', '3.00', '19.00', '20.00'),
  ) +
  window(
    '950',
    '%WINDOW4',
    'T',
    graphic('%GRAPHIC2', '&amp;GV_SIGN&amp;', 'BMON'),
    winPos('14.50', '23.20', '4.90', '2.50'),
    cond('LPAGE'),
  ) +
  `</sf:SUCC></sf:NODE></sf:item></sf:SUCC></sf:NODE></sf:PAGETREE></sf:item></sf:VARHEADER></sf:SMARTFORM>`;

describe('parseSmartFormXml', () => {
  const parsed = parseSmartFormXml(XML);
  const page = parsed.pages[0];
  const byName = (n: string) => page.windows.find((w) => w.name === n)!;

  it('reads the page and window names from <NAME><INAME>', () => {
    expect(parsed.pages).toHaveLength(1);
    expect(page.name).toBe('%PAGE1');
    expect(page.nextPage).toBe('%PAGE1');
    expect(page.format).toBe('DINA4');
    expect(page.orientation).toBe('portrait');
    expect(page.windows.map((w) => w.name)).toEqual([
      '%GRAPHIC1',
      '%WINDOW1',
      'MAIN',
      '%WINDOW4',
    ]);
    expect(parsed.stdStyles).toEqual(['ZTEST_STYLE']);
  });

  it('converts window positions to mm', () => {
    const w = byName('%WINDOW1');
    expect(w).toMatchObject({
      type: 'SECONDARY',
      leftMm: 10,
      topMm: 15,
      widthMm: 190,
      heightMm: 10,
    });
  });

  it('takes window content from PROC_CTRL and flattens the RC container', () => {
    const c = byName('%WINDOW1').content;
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      kind: 'text',
      name: '%TEXT1',
      style: 'ZTEST_STYLE',
      lines: [{ format: 'BJ', text: '<AA>PURCHASE ORDER</>' }],
    });
  });

  it('reads graphics in a graphic window and in a text window', () => {
    expect(byName('%GRAPHIC1').content[0].graphic).toMatchObject({
      name: 'ZTEST_LOGO',
      btype: 'BCOL',
      dynamic: false,
    });
    expect(parsed.graphicKeys.map((g) => g.name)).toEqual(['ZTEST_LOGO']);
    // a key with a &symbol& is only known at print time
    expect(byName('%WINDOW4').content[0].graphic?.dynamic).toBe(true);
    expect(parsed.dynamic).toEqual([
      'graphic %GRAPHIC2: GRAPHICS &GV_SIGN& BMAP BMON',
    ]);
  });

  it('names page conditions', () => {
    expect(byName('%WINDOW4').condition).toEqual({ afterMainEnd: true });
    expect(byName('MAIN').content[0].condition).toEqual({ firstPage: true });
  });

  it('reads template lines, cells and the cell of each text', () => {
    const t = byName('MAIN').content[0];
    expect(t.kind).toBe('template');
    expect(t.width?.mm).toBe(190);
    expect(t.templateLines).toEqual([
      { name: '%C1', from: 1, to: 2, heightMm: 6, shading: 0 },
    ]);
    expect(t.cells).toHaveLength(3);
    expect(t.cells[1].fill).toBeUndefined();
    expect(t.cells[2].fill).toBe('#8080ff');
    const cell = t.cells[0];
    expect(cell).toMatchObject({
      line: '%C1',
      column: 1,
      widthMm: 30,
      fill: '#d4d4d4',
    });
    // 15 TW = 0.26 mm; zero width or USED unset → no border
    expect(cell.borders.left).toBeCloseTo(0.26, 1);
    expect(cell.borders.top).toBe(0);
    expect(cell.borders.right).toBe(0);
    expect(cell.borders.bottom).toBeCloseTo(0.26, 1);
    expect(t.children.map((c) => [c.name, c.tableCell])).toEqual([
      ['%TEXT7', { line: 1, cell: 1 }],
      ['%TEXT9', { line: 2, cell: 1 }],
    ]);
    expect(t.children[1].lines?.[0].text).toBe('&HEADER-NAME1&');
  });
});

describe('data declarations and symbols', () => {
  const parsed = parseSmartFormXml(XML);

  it('keeps own interface parameters and global data, drops standard ones and exceptions', () => {
    expect(parsed.data).toEqual([
      {
        name: 'HEADER',
        scope: 'import',
        typing: 'TYPE',
        typeName: 'ZTEST_S_HEAD',
      },
      {
        name: 'ITEM',
        scope: 'tables',
        typing: 'LIKE',
        typeName: 'ZTEST_S_ITEM',
      },
      {
        name: 'GS_ITEM',
        scope: 'global',
        typing: 'TYPE',
        typeName: 'ZTEST_S_ITEM',
      },
    ]);
  });

  it('lists the printed &symbols& without formatting options', () => {
    expect(symbolsOf(parsed.pages)).toEqual(['HEADER-NAME1']);
  });
});

describe('helpers', () => {
  it('hasSymbol', () => {
    expect(hasSymbol('&GV_LOGO&')).toBe(true);
    expect(hasSymbol('ZLOGO')).toBe(false);
  });

  it('translates a missing dispatcher action into the install hint', () => {
    expect(
      translateSmartFormContentError(new Error('Unknown action: SSF_CONTENT')),
    ).toMatch(/ZMCP_SSF_CONTENT/);
  });
});
