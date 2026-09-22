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
