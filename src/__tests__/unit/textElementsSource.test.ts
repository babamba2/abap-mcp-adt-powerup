import {
  groupBySubsource,
  parseHeadingsSource,
  parseSelectionsSource,
  parseSymbolsSource,
  serializeHeadingsSource,
  serializeSelectionsSource,
  serializeSymbolsSource,
} from '../../lib/textElementsSource';

// Fixtures captured from live S/4HANA (scripts/adhoc/raw-out/te2-*.txt).
const LIVE_SYMBOLS =
  '@MaxLength:10\r\n001=텍스트 심볼 001\r\n\r\n@MaxLength:15\r\n042=Text Symbol 042';
const LIVE_SELECTIONS = 'P_DATE  =처리일자\r\n\r\nSO_CARRI=Carrier ID';
const LIVE_HEADINGS =
  'listHeader=\r\n\r\ncolumnHeader_1=\r\ncolumnHeader_2=\r\ncolumnHeader_3=\r\ncolumnHeader_4=';

describe('parseSymbolsSource', () => {
  it('parses the live @MaxLength / KEY=TEXT format', () => {
    const rows = parseSymbolsSource(LIVE_SYMBOLS);
    expect(rows).toEqual([
      { key: '001', text: '텍스트 심볼 001', maxLength: 10 },
      { key: '042', text: 'Text Symbol 042', maxLength: 15 },
    ]);
  });

  it('returns empty array for empty body', () => {
    expect(parseSymbolsSource('')).toEqual([]);
  });

  it('tolerates LF-only separators (Unix callers)', () => {
    expect(
      parseSymbolsSource('@MaxLength:5\n001=hi\n\n@MaxLength:7\n002=there'),
    ).toEqual([
      { key: '001', text: 'hi', maxLength: 5 },
      { key: '002', text: 'there', maxLength: 7 },
    ]);
  });
});

describe('serializeSymbolsSource', () => {
  it('round-trips the live fixture', () => {
    const rows = parseSymbolsSource(LIVE_SYMBOLS);
    const rendered = serializeSymbolsSource(rows);
    expect(rendered).toBe(LIVE_SYMBOLS);
  });

  it('uses 40 as default maxLength when caller omits it', () => {
    const out = serializeSymbolsSource([{ key: '999', text: 'hello' }]);
    expect(out).toBe('@MaxLength:40\r\n999=hello');
  });

  it('throws when key is missing', () => {
    expect(() =>
      serializeSymbolsSource([{ key: '', text: 'x' } as any]),
    ).toThrow(/missing key/);
  });

  it('throws on invalid maxLength', () => {
    expect(() =>
      serializeSymbolsSource([{ key: '1', text: 'x', maxLength: 0 }]),
    ).toThrow(/invalid maxLength/);
  });
});

describe('parseSelectionsSource', () => {
  it('parses the live padded-key format', () => {
    const rows = parseSelectionsSource(LIVE_SELECTIONS);
    expect(rows).toEqual([
      { key: 'P_DATE', text: '처리일자' },
      { key: 'SO_CARRI', text: 'Carrier ID' },
    ]);
  });
});

describe('serializeSelectionsSource', () => {
  it('pads keys to 8 chars and round-trips', () => {
    const rows = parseSelectionsSource(LIVE_SELECTIONS);
    const rendered = serializeSelectionsSource(rows);
    expect(rendered).toBe(LIVE_SELECTIONS);
  });

  it('upper-cases keys (SAP param names are uppercase)', () => {
    expect(
      serializeSelectionsSource([{ key: 'so_carri', text: 'Carrier ID' }]),
    ).toBe('SO_CARRI=Carrier ID');
  });

  it('rejects keys longer than 8 characters', () => {
    expect(() =>
      serializeSelectionsSource([{ key: 'TOO_LONG9', text: 'x' }]),
    ).toThrow(/exceeds 8/);
  });
});

describe('parseHeadingsSource', () => {
  it('parses listHeader + columnHeader_N rows', () => {
    const rows = parseHeadingsSource(LIVE_HEADINGS);
    expect(rows.map((r) => r.key)).toEqual([
      'listHeader',
      'columnHeader_1',
      'columnHeader_2',
      'columnHeader_3',
      'columnHeader_4',
    ]);
    expect(rows.every((r) => r.text === '')).toBe(true);
  });
});

describe('serializeHeadingsSource', () => {
  it('rejects keys outside the fixed listHeader/columnHeader_N set', () => {
    expect(() =>
      serializeHeadingsSource([{ key: 'arbitrary', text: 'nope' }]),
    ).toThrow(/not supported/);
  });

  it('orders columnHeader_N numerically', () => {
    const out = serializeHeadingsSource([
      { key: 'columnHeader_10', text: 'tenth' },
      { key: 'columnHeader_2', text: 'second' },
      { key: 'listHeader', text: 'top' },
    ]);
    // Blank line between listHeader and the first columnHeader row.
    expect(out).toBe(
      'listHeader=top\r\n\r\ncolumnHeader_2=second\r\ncolumnHeader_10=tenth',
    );
  });
});

describe('groupBySubsource', () => {
  it('routes entries into symbols/selections/headings buckets', () => {
    const out = groupBySubsource([
      { type: 'I', key: '001', text: 'a' },
      { type: 'S', key: 'P_DATE', text: 'b' },
      { type: 'H', key: 'listHeader', text: 'c' },
      { type: 'I', key: '002', text: 'd', max_length: 20 },
    ]);
    expect(out.symbols).toEqual([
      { key: '001', text: 'a' },
      { key: '002', text: 'd', maxLength: 20 },
    ]);
    expect(out.selections).toEqual([{ key: 'P_DATE', text: 'b' }]);
    expect(out.headings).toEqual([{ key: 'listHeader', text: 'c' }]);
  });

  it('throws on an unsupported type', () => {
    expect(() =>
      groupBySubsource([{ type: 'Q' as any, key: 'x', text: 'y' }]),
    ).toThrow(/Unsupported/);
  });
});
