import { stripDumpSummaries } from '../../handlers/system/readonly/handleRuntimeListDumps';

const entry = (id: string) => ({
  'atom:author': { 'atom:name': 'SAP_SYSTEM' },
  'atom:category': [
    { term: 'CONVT_NO_NUMBER', label: 'ABAP runtime error' },
    { term: 'ZPROG', label: 'Terminated ABAP program' },
  ],
  'atom:id': `/sap/bc/adt/vit/runtime/dumps/${id}`,
  'atom:link': [
    { href: `adt://SYS/sap/bc/adt/runtime/dump/${id}`, rel: 'self' },
  ],
  'atom:published': '2026-09-17T03:12:05Z',
  'atom:summary': { '#text': '<table>'.padEnd(12000, 'x'), type: 'html' },
  'atom:title': 'Unable to interpret "INR" as a number.',
  'atom:updated': '2026-09-17T03:12:05Z',
});

const feed = (entries: unknown) => ({
  '?xml': { version: '1.0' },
  'atom:feed': { 'atom:title': 'dumps', 'atom:entry': entries },
});

describe('stripDumpSummaries', () => {
  it('drops atom:summary from every entry and keeps everything else', () => {
    const out = stripDumpSummaries(feed([entry('A'), entry('B')])) as any;
    const entries = out['atom:feed']['atom:entry'];
    expect(entries).toHaveLength(2);
    for (const e of entries) {
      expect(e).not.toHaveProperty('atom:summary');
      expect(e['atom:category'][0].term).toBe('CONVT_NO_NUMBER');
      expect(e['atom:id']).toMatch(/^\/sap\/bc\/adt\/vit\/runtime\/dumps\//);
      expect(e['atom:title']).toContain('INR');
    }
    expect(out['atom:feed']['atom:title']).toBe('dumps');
    expect(out['?xml']).toEqual({ version: '1.0' });
    expect(JSON.stringify(out).length).toBeLessThan(2000);
  });

  it('handles a feed with a single entry object', () => {
    const out = stripDumpSummaries(feed(entry('ONE'))) as any;
    expect(out['atom:feed']['atom:entry']).not.toHaveProperty('atom:summary');
    expect(out['atom:feed']['atom:entry']['atom:id']).toContain('ONE');
  });

  it('does not mutate the input', () => {
    const input = feed([entry('A')]);
    stripDumpSummaries(input);
    expect((input as any)['atom:feed']['atom:entry'][0]).toHaveProperty(
      'atom:summary',
    );
  });

  it('passes through anything that is not a dump feed', () => {
    expect(stripDumpSummaries('<raw/>')).toBe('<raw/>');
    expect(stripDumpSummaries(null)).toBeNull();
    expect(stripDumpSummaries({ other: 1 })).toEqual({ other: 1 });
    const empty = stripDumpSummaries(feed(undefined)) as any;
    expect(empty['atom:feed']['atom:entry']).toBeUndefined();
  });
});

describe('pageFeedBack (feed paged by its time cursor)', () => {
  const {
    nextFeedCursor,
    pageFeedBack,
  } = require('../../handlers/system/readonly/handleRuntimeListDumps');
  const e = (id: string, published: string) => ({
    'atom:id': id,
    'atom:published': published,
  });
  const page = (entries: unknown[], next?: string) => ({
    'atom:feed': {
      'atom:entry': entries,
      'atom:link': [
        {
          rel: 'self',
          href: '/sap/bc/adt/runtime/dumps?%24top=2&from=20261116025014',
        },
        ...(next
          ? [
              {
                rel: 'next',
                href: `/sap/bc/adt/runtime/dumps?%24top=2&to=${next}`,
              },
            ]
          : []),
      ],
    },
  });

  it('reads the next cursor', () => {
    expect(nextFeedCursor(page([], '20261114154628'))).toBe('20261114154628');
    expect(nextFeedCursor(page([]))).toBeNull();
  });

  it('follows the cursor until an entry is older than date_from, deduplicating the boundary entry', async () => {
    const first = page(
      [e('a', '2026-11-16T02:00:00Z'), e('b', '2026-11-15T02:00:00Z')],
      '20261115020000',
    );
    const pages: Record<string, unknown> = {
      '20261115020000': page(
        [e('b', '2026-11-15T02:00:00Z'), e('c', '2026-11-12T02:00:00Z')],
        '20261112020000',
      ),
      '20261112020000': page(
        [e('d', '2026-11-08T02:00:00Z')],
        '20261108020000',
      ),
    };
    const asked: string[] = [];
    const r = await pageFeedBack(first, '20261110', async (c: string) => {
      asked.push(c);
      return pages[c];
    });
    expect(r).toMatchObject({
      complete: true,
      reached: true,
      oldest: '20261108',
    });
    expect(asked).toEqual(['20261115020000', '20261112020000']);
    expect(
      r.parsed['atom:feed']['atom:entry'].map((x: any) => x['atom:id']),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('stops at maxPages and says it did not reach date_from', async () => {
    let n = 0;
    const r = await pageFeedBack(
      page([e('p0', '2026-11-16T00:00:00Z')], '20261116000000'),
      '20260101',
      async () => {
        n += 1;
        return page(
          [e(`p${n}`, '2026-11-16T00:00:00Z')],
          String(20261115000000 - n),
        );
      },
      3,
    );
    expect(r).toMatchObject({ pages: 3, complete: false, reached: false });
  });
});

describe('pageFeedBack retention', () => {
  const {
    pageFeedBack,
  } = require('../../handlers/system/readonly/handleRuntimeListDumps');
  it('a feed that ends before date_from is complete but not reached', async () => {
    const first = {
      'atom:feed': {
        'atom:entry': [
          { 'atom:id': 'a', 'atom:published': '2026-11-10T00:00:00Z' },
        ],
      },
    };
    const r = await pageFeedBack(first, '20261103', async () => ({}));
    expect(r).toMatchObject({
      complete: true,
      reached: false,
      oldest: '20261110',
    });
  });
});
