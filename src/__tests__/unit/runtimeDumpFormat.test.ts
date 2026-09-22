import {
  compactFormattedDump,
  DEVELOPER_CHAPTERS,
  extractDumpFacts,
  extractFormattedHeaderFacts,
  splitFormattedDump,
} from '../../handlers/system/readonly/runtimeDumpFormat';

const RULE = '-'.repeat(100);
const box = (s: string) => `|${s.padEnd(98)}|`;
const chapter = (title: string, body: string[]) =>
  [RULE, box(title), ...body.map(box), RULE].join('\r\n');

const FORMATTED = [
  [
    RULE,
    'Category               ABAP programming error'.padEnd(300),
    'Runtime Errors         UNCAUGHT_EXCEPTION'.padEnd(300),
    'Except.                ZCX_DEMO'.padEnd(300),
    'ABAP: Program          ZDEMO_PROG'.padEnd(300),
    'Date and Time          09/22/2026 11:16:58 (UTC)'.padEnd(300),
    RULE,
  ].join('\r\n'),
  chapter('Short Text', ['    An exception has occurred that was not caught.']),
  chapter('What happened?', ['    The exception "ZCX_DEMO" was not caught.']),
  chapter('System environment', ['    SAP Release..... 816'.padEnd(90)]),
  [
    RULE,
    box('Source Code Extract'),
    RULE,
    box('Line |Code'),
    RULE,
    box('    9|raise EXCEPTION type zcx_demo.'),
    RULE,
  ].join('\r\n'),
  chapter('Active Calls in SAP Kernel', [
    '    kernel frame 1',
    '    kernel frame 2',
  ]),
  chapter('Selected Variables', ['    SY-SUBRC  0']),
].join('\r\n\r\n');

const DEFAULT_VIEW = {
  '?xml': { version: '1.0' },
  'dump:dump': {
    'dump:links': {
      'dump:link': [
        { relation: 'self', uri: '/sap/bc/adt/runtime/dump/X' },
        {
          relation: 'http://www.sap.com/adt/relations/runtime/dump/termination',
          uri: 'adt://SYS/sap/bc/adt/programs/programs/zdemo_prog/source/main#start=9',
        },
      ],
    },
    'dump:chapters': {
      'dump:chapter': [
        {
          name: 'kap5',
          title: 'System environment',
          line: '81',
          chapterOrder: '6',
        },
        { name: 'kap0', title: 'Short Text', line: '11', chapterOrder: '1' },
      ],
    },
    title: 'Runtime Error: UNCAUGHT_EXCEPTION',
    error: 'UNCAUGHT_EXCEPTION',
    author: 'DEVUSER',
    exception: 'ZCX_DEMO',
    terminatedProgram: 'ZDEMO_PROG',
    serverInstance: 'host_SYS_00',
    datetime: '2026-09-22T11:16:58Z',
  },
};

describe('extractDumpFacts', () => {
  it('reads the dump root and the termination link, not the first chapter', () => {
    const facts = extractDumpFacts(DEFAULT_VIEW);
    expect(facts.runtimeError).toBe('UNCAUGHT_EXCEPTION');
    expect(facts.exception).toBe('ZCX_DEMO');
    expect(facts.program).toBe('ZDEMO_PROG');
    expect(facts.user).toBe('DEVUSER');
    expect(facts.title).toBe('Runtime Error: UNCAUGHT_EXCEPTION');
    expect(facts.termination).toEqual({
      uri: 'adt://SYS/sap/bc/adt/programs/programs/zdemo_prog/source/main#start=9',
      object: 'programs/programs/zdemo_prog',
      line: 9,
    });
    expect(facts.chapters?.map((c) => c.title)).toEqual([
      'Short Text',
      'System environment',
    ]);
  });

  it('returns an empty object for anything that is not a default dump view', () => {
    expect(extractDumpFacts(FORMATTED)).toEqual({});
    expect(extractDumpFacts(null)).toEqual({});
    expect(extractDumpFacts({ other: 1 })).toEqual({});
  });
});

describe('extractFormattedHeaderFacts', () => {
  it('reads the header block of the long text', () => {
    expect(extractFormattedHeaderFacts(FORMATTED)).toEqual({
      runtimeError: 'UNCAUGHT_EXCEPTION',
      exception: 'ZCX_DEMO',
      program: 'ZDEMO_PROG',
      datetime: '09/22/2026 11:16:58 (UTC)',
    });
  });
});

describe('splitFormattedDump', () => {
  it('finds every chapter title and unboxes the body', () => {
    const { header, chapters } = splitFormattedDump(FORMATTED);
    expect(header[0]).toBe('Category               ABAP programming error');
    expect(chapters.map((c) => c.title)).toEqual([
      'Short Text',
      'What happened?',
      'System environment',
      'Source Code Extract',
      'Active Calls in SAP Kernel',
      'Selected Variables',
    ]);
    const src = chapters.find((c) => c.title === 'Source Code Extract');
    expect(src?.body).toEqual([
      'Line |Code',
      '    9|raise EXCEPTION type zcx_demo.',
    ]);
  });
});

describe('compactFormattedDump', () => {
  it('keeps the header and developer chapters, drops the rest', () => {
    const out = compactFormattedDump(FORMATTED, ['developer']);
    expect(out).toContain('Runtime Errors         UNCAUGHT_EXCEPTION');
    expect(out).toContain('## Short Text');
    expect(out).toContain('## Source Code Extract');
    expect(out).toContain('    9|raise EXCEPTION type zcx_demo.');
    expect(out).not.toContain('## System environment');
    expect(out).not.toContain('kernel frame');
    expect(out).not.toContain('SY-SUBRC');
    expect(out).not.toMatch(/-{20}/);
    expect(out).not.toMatch(/ +$/m);
    expect(out).toMatch(
      /omitted: System environment, Active Calls in SAP Kernel, Selected Variables/,
    );
    expect(out.length).toBeLessThan(FORMATTED.length / 3);
  });

  it('accepts explicit titles by case-insensitive prefix', () => {
    const out = compactFormattedDump(FORMATTED, ['selected var']);
    expect(out).toContain('## Selected Variables');
    expect(out).not.toContain('## Short Text');
  });

  it('exposes the developer preset', () => {
    expect(DEVELOPER_CHAPTERS).toContain('Source Code Extract');
  });
});
