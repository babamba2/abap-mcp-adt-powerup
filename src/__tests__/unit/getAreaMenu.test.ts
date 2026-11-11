import {
  isCustomerMenu,
  pickTexts,
  walkAreaMenu,
} from '../../handlers/system/readonly/handleGetAreaMenu';

const node = (
  NODE_ID: string,
  PARENT_ID: string,
  NODE_TYPE: string,
  BROTHER_ID = '',
) => ({ NODE_ID, PARENT_ID, NODE_TYPE, BROTHER_ID });

describe('GetAreaMenu (TMENU01 / TMENU01R / TMENU01T)', () => {
  it('prefers the requested language and skips texts stored as ####', () => {
    const t = pickTexts(
      [
        { NODE_ID: 'A', SPRAS: 'E', TEXT: 'Sales' },
        { NODE_ID: 'A', SPRAS: '3', TEXT: '## ##(##)' },
        { NODE_ID: 'B', SPRAS: 'D', TEXT: 'Verkauf' },
        { NODE_ID: 'B', SPRAS: 'E', TEXT: 'Selling' },
      ],
      '3',
      'E',
    );
    expect(t.get('A')).toBe('Sales');
    expect(t.get('B')).toBe('Selling');
  });

  it('walks folders in sibling order and maps t-codes and menu links', () => {
    const walked = walkAreaMenu(
      {
        menu: 'ZSDX',
        masterLang: 'E',
        nodes: [
          node('R', '', 'NULL'),
          // F2 is listed first but F1 points to it as next sibling
          node('F2', 'R', 'NULL'),
          node('F1', 'R', 'NULL', 'F2'),
          node('T1', 'F1', 'TCOD', 'T2'),
          node('T2', 'F1', 'TCOD'),
          node('L1', 'F2', 'AMRF'),
        ],
        texts: [
          { NODE_ID: 'R', SPRAS: 'E', TEXT: 'Sales menu' },
          { NODE_ID: 'F1', SPRAS: 'E', TEXT: 'Orders' },
          { NODE_ID: 'F2', SPRAS: 'E', TEXT: 'Reports' },
          { NODE_ID: 'T1', SPRAS: 'E', TEXT: 'Create order' },
        ],
        refs: [
          { NODE_ID: 'T1', REF_TYPE: 'TCOD', REF_OBJECT: 'VA01' },
          { NODE_ID: 'T2', REF_TYPE: 'TCOD', REF_OBJECT: 'ZSD_ORDER' },
          { NODE_ID: 'L1', REF_TYPE: 'TREE', REF_OBJECT: 'ZSDREP' },
          { NODE_ID: 'T1', REF_TYPE: 'BMFR', REF_OBJECT: 'HLA0009999' },
        ],
      },
      undefined,
    );
    expect(walked.title).toBe('Sales menu');
    expect(walked.folders).toEqual([['Orders'], ['Reports']]);
    expect(walked.entries).toEqual([
      { tcode: 'VA01', text: 'Create order', path: ['Orders'], menu: 'ZSDX' },
      { tcode: 'ZSD_ORDER', text: '', path: ['Orders'], menu: 'ZSDX' },
    ]);
    expect(walked.links).toEqual([{ path: ['Reports'], target: 'ZSDREP' }]);
  });

  it('prefixes a linked menu with the folder path of the link', () => {
    const walked = walkAreaMenu(
      {
        menu: 'ZSDREP',
        masterLang: 'E',
        nodes: [node('R', '', 'NULL'), node('T', 'R', 'TCOD')],
        texts: [],
        refs: [{ NODE_ID: 'T', REF_TYPE: 'TCOD', REF_OBJECT: 'ZSDR0001' }],
      },
      'E',
      ['Reports'],
    );
    expect(walked.entries[0]).toMatchObject({
      tcode: 'ZSDR0001',
      path: ['Reports'],
      menu: 'ZSDREP',
    });
  });

  it('treats Z, Y and namespace menus as customer menus', () => {
    expect(isCustomerMenu('ZXX00')).toBe(true);
    expect(isCustomerMenu('YMENU')).toBe(true);
    expect(isCustomerMenu('/ABC/MENU')).toBe(true);
    expect(isCustomerMenu('S000_INFO_LO')).toBe(false);
  });
});
