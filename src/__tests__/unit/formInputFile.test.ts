import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readFormInputFile } from '../../lib/valuesFile';

describe('readFormInputFile — confined XDP / XML input', () => {
  let outDir: string;
  let other: string;
  const saved = process.env.MCP_OUTPUT_DIR;
  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fi-out-'));
    other = fs.mkdtempSync(path.join(os.tmpdir(), 'fi-other-'));
    process.env.MCP_OUTPUT_DIR = outDir;
    fs.writeFileSync(path.join(outDir, 't.xdp'), '<xdp/>');
    fs.writeFileSync(path.join(outDir, 'd.xml'), '<Form/>');
    fs.writeFileSync(path.join(other, 'x.xdp'), '<secret/>');
  });
  afterAll(() => {
    process.env.MCP_OUTPUT_DIR = saved;
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  });

  it('reads an allowed file inside the output directory', () => {
    expect(readFormInputFile('t.xdp', 'xdp_file', ['.xdp']).toString()).toBe(
      '<xdp/>',
    );
    expect(
      readFormInputFile(path.join(outDir, 'd.xml'), 'xml_file', [
        '.xml',
      ]).toString(),
    ).toBe('<Form/>');
  });

  it('refuses outside paths, wrong extensions, secrets and UNC without echoing content', () => {
    expect(() =>
      readFormInputFile(path.join(other, 'x.xdp'), 'xdp_file', ['.xdp']),
    ).toThrow(/refused/);
    expect(() => readFormInputFile('../x.xdp', 'xdp_file', ['.xdp'])).toThrow(
      /refused/,
    );
    expect(() => readFormInputFile('t.xdp', 'xml_file', ['.xml'])).toThrow(
      /\.xml file is expected/,
    );
    expect(() =>
      readFormInputFile('sap.env.xdp', 'xdp_file', ['.xdp']),
    ).toThrow(/secret/);
    expect(() =>
      readFormInputFile('\\\\host\\share\\t.xdp', 'xdp_file', ['.xdp']),
    ).toThrow(/UNC/);
    try {
      readFormInputFile(path.join(other, 'x.xdp'), 'xdp_file', ['.xdp']);
    } catch (e) {
      expect(String(e)).not.toContain('secret/>');
    }
  });
});
