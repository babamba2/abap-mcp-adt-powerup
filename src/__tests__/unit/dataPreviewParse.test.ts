import { parseSqlQueryXml } from '../../handlers/system/readonly/handleGetSqlQuery';
import { compactTableContents } from '../../handlers/table/readonly/handleGetTableContents';
import { decodeXmlEntities } from '../../lib/xmlEntities';

/** Data preview XML in the column-major shape ADT returns; '' = empty cell. */
function previewXml(
  columns: Array<{ name: string; description: string; values: string[] }>,
  totalRows: number,
): string {
  const cols = columns
    .map((c) => {
      const cells = c.values
        .map((v) =>
          v === ''
            ? '<dataPreview:data/>'
            : `<dataPreview:data>${v}</dataPreview:data>`,
        )
        .join('');
      return (
        '<dataPreview:columns>' +
        `<dataPreview:metadata dataPreview:name="${c.name}" dataPreview:type="C" dataPreview:description="${c.description}" dataPreview:length="10"/>` +
        `<dataPreview:dataSet>${cells}</dataPreview:dataSet>` +
        '</dataPreview:columns>'
      );
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<dataPreview:tableData xmlns:dataPreview="http://www.sap.com/adt/dataPreview">' +
    `<dataPreview:totalRows>${totalRows}</dataPreview:totalRows>` +
    '<dataPreview:queryExecutionTime>0.5</dataPreview:queryExecutionTime>' +
    cols +
    '</dataPreview:tableData>'
  );
}

// Four clients; LOGSYS and CCIMAILDIS have empty cells, like T000.
const T000 = previewXml(
  [
    {
      name: 'MANDT',
      description: 'Client',
      values: ['000', '100', '200', '400'],
    },
    {
      name: 'MTEXT',
      description: 'Name',
      values: [
        'SAP AG',
        'Demo client US &amp; DE',
        'GTS 200',
        'Fully-activated client',
      ],
    },
    {
      name: 'CCIMAILDIS',
      description: 'CATT Allowed',
      values: ['X', '', 'X', ''],
    },
    {
      name: 'LOGSYS',
      description: 'Logical system',
      values: ['', 'S4HCLNT100', 'GTSC1NT200', ''],
    },
  ],
  4,
);

describe('parseSqlQueryXml', () => {
  it('keeps empty cells in place so later values do not move up a row', () => {
    const { rows } = parseSqlQueryXml(T000, 'SELECT * FROM T000', 100);
    expect(rows.map((r) => r.LOGSYS)).toEqual([
      null,
      'S4HCLNT100',
      'GTSC1NT200',
      null,
    ]);
    expect(rows.map((r) => r.CCIMAILDIS)).toEqual(['X', null, 'X', null]);
    expect(rows[1]).toMatchObject({ MANDT: '100', LOGSYS: 'S4HCLNT100' });
  });

  it('decodes XML entities in values', () => {
    const { rows } = parseSqlQueryXml(T000, 'SELECT * FROM T000', 100);
    expect(rows[1].MTEXT).toBe('Demo client US & DE');
  });

  it('cuts to the requested row count and flags the cut', () => {
    const parsed = parseSqlQueryXml(T000, 'SELECT * FROM T000', 3);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.truncated).toBe(true);
    const all = parseSqlQueryXml(T000, 'SELECT * FROM T000', 4);
    expect(all.rows).toHaveLength(4);
    expect(all.truncated).toBeUndefined();
  });

  it('keeps an explicitly empty <dataPreview:data></dataPreview:data> as one cell', () => {
    const xml = T000.replace(
      '<dataPreview:data/><dataPreview:data>S4HCLNT100',
      '<dataPreview:data></dataPreview:data><dataPreview:data>S4HCLNT100',
    );
    const { rows } = parseSqlQueryXml(xml, 'q', 100);
    expect(rows.map((r) => r.LOGSYS)).toEqual([
      null,
      'S4HCLNT100',
      'GTSC1NT200',
      null,
    ]);
  });
});

describe('compactTableContents', () => {
  const parsed = parseSqlQueryXml(T000, 'SELECT * FROM T000', 2);

  it('lists column names, leaves empty cells out and flags truncation', () => {
    const out = compactTableContents('T000', parsed);
    expect(out.columns).toEqual(['MANDT', 'MTEXT', 'CCIMAILDIS', 'LOGSYS']);
    expect(out.rows).toEqual([
      { MANDT: '000', MTEXT: 'SAP AG', CCIMAILDIS: 'X' },
      { MANDT: '100', MTEXT: 'Demo client US & DE', LOGSYS: 'S4HCLNT100' },
    ]);
    expect(out.truncated).toBe(true);
    expect(out.rows_returned).toBe(2);
  });

  it('keeps only the requested fields and reports unknown ones', () => {
    const out = compactTableContents('T000', parsed, {
      fields: ['mandt', 'LOGSYS', 'NOPE'],
    });
    expect(out.columns).toEqual(['MANDT', 'LOGSYS']);
    expect(out.rows).toEqual([
      { MANDT: '000' },
      { MANDT: '100', LOGSYS: 'S4HCLNT100' },
    ]);
    expect(out.unknown_fields).toEqual(['NOPE']);
  });

  it('returns full column metadata on request', () => {
    const out = compactTableContents('T000', parsed, { includeMetadata: true });
    expect((out.columns as any[])[0]).toMatchObject({
      name: 'MANDT',
      type: 'C',
      length: 10,
    });
  });

  it('is much smaller than the pretty-printed parse', () => {
    const full = parseSqlQueryXml(T000, 'SELECT * FROM T000', 100);
    const compact = JSON.stringify(compactTableContents('T000', full));
    expect(compact.length).toBeLessThan(
      JSON.stringify(full, null, 2).length / 2,
    );
  });
});

describe('decodeXmlEntities', () => {
  it('decodes named and numeric entities, &amp; last', () => {
    expect(
      decodeXmlEntities(
        'a &lt;b&gt; &quot;c&quot; &apos;d&apos; &#65;&#x42; &amp;lt;',
      ),
    ).toBe('a <b> "c" \'d\' AB &lt;');
    expect(decodeXmlEntities('plain')).toBe('plain');
  });
});
