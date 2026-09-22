import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findIncludes } from '../../handlers/program/readonly/handleGetProgFullCode';
import {
  abapOutline,
  outputRoot,
  safeOutputPath,
  sourceFileName,
  writeSourceFile,
} from '../../lib/sourceOutput';
import { writeResultToFile } from '../../lib/writeResultToFile';

const REPORT = [
  '*&---------------------------------------------------------------------*',
  '*& Report ZDEMO',
  'REPORT zdemo.',
  'INCLUDE zdemo_top.',
  'INCLUDE zdemo_f01.   " forms',
  '',
  'CLASS lcl_app DEFINITION DEFERRED.',
  'CLASS lcl_app DEFINITION.',
  '  PUBLIC SECTION.',
  '    METHODS run.',
  '    INTERFACES zif_demo.',
  'ENDCLASS.',
  '',
  'CLASS lcl_app IMPLEMENTATION.',
  '  METHOD run.',
  '    " METHOD not_a_block.',
  '  ENDMETHOD.',
  'ENDCLASS.',
  '',
  'START-OF-SELECTION.',
  '  PERFORM main.',
  '',
  'FORM main.',
  '  DATA ls TYPE zs. INCLUDE STRUCTURE zs2.',
  'ENDFORM.',
  '',
  'module status_0100 output.',
  'endmodule.',
].join('\r\n');

describe('abapOutline', () => {
  it('lists blocks with line ranges and events, skipping comments and deferred classes', () => {
    const { outline, truncated } = abapOutline(REPORT);
    expect(outline).toEqual([
      '3 REPORT zdemo',
      '4 INCLUDE zdemo_top',
      '5 INCLUDE zdemo_f01',
      '8-12 CLASS lcl_app DEFINITION',
      '14-18 CLASS lcl_app IMPLEMENTATION',
      '15-17 METHOD run',
      '20 START-OF-SELECTION',
      '23-25 FORM main',
      '27-28 MODULE status_0100 OUTPUT',
    ]);
    expect(truncated).toBe(false);
  });

  it('caps very long outlines', () => {
    const src = Array.from(
      { length: 450 },
      (_, i) => `FORM f${i}.\nENDFORM.`,
    ).join('\n');
    const { outline, truncated } = abapOutline(src);
    expect(outline).toHaveLength(400);
    expect(truncated).toBe(true);
  });
});

describe('findIncludes', () => {
  it('finds INCLUDE with trailing comments and INCLUDE: lists, not STRUCTURE/TYPE', () => {
    const fugrMain = [
      '*******************************************************************',
      '  INCLUDE LZDEMOTOP.                         " Global Declarations',
      '  INCLUDE LZDEMOUXX.                         " Function Modules',
      'INCLUDE: lzdemof01, lzdemof02.',
      'INCLUDE STRUCTURE zs.',
    ].join('\r\n');
    expect(findIncludes(fugrMain)).toEqual([
      'LZDEMOTOP',
      'LZDEMOUXX',
      'LZDEMOF01',
      'LZDEMOF02',
    ]);
  });
});

describe('output directory', () => {
  const OLD = process.env.MCP_OUTPUT_DIR;
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-out-'));
    process.env.MCP_OUTPUT_DIR = dir;
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (OLD === undefined) delete process.env.MCP_OUTPUT_DIR;
    else process.env.MCP_OUTPUT_DIR = OLD;
  });

  it('resolves inside the root and refuses anything outside it', () => {
    expect(outputRoot()).toBe(path.resolve(dir));
    expect(safeOutputPath('src/a.abap')).toBe(path.join(dir, 'src', 'a.abap'));
    expect(() => safeOutputPath('../escape.txt')).toThrow(/outside/);
    expect(() => safeOutputPath(path.join(os.tmpdir(), 'x.txt'))).toThrow(
      /outside/,
    );
    expect(() => safeOutputPath('.')).toThrow(/outside/);
  });

  it('writeResultToFile no longer writes outside the root', () => {
    expect(() => writeResultToFile('x', '../../evil.txt')).toThrow(/outside/);
    writeResultToFile('ok', 'sub/ok.txt');
    expect(fs.readFileSync(path.join(dir, 'sub', 'ok.txt'), 'utf8')).toBe('ok');
  });

  it('writes the source unchanged and describes it', () => {
    const w = writeSourceFile(
      sourceFileName('/CBY/ZDEMO', 'prog', 'inactive'),
      REPORT,
      'zdemo.prog',
    );
    expect(w.path).toBe(
      path.join(dir, 'src', 'zdemo.prog', '#cby#zdemo.prog.inactive.abap'),
    );
    expect(fs.readFileSync(w.path, 'utf8')).toBe(REPORT);
    expect(w.lines).toBe(28);
    expect(w.outline[0]).toBe('3 REPORT zdemo');
  });
});
