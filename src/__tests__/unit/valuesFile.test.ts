import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  MAX_VALUES_BYTES,
  readValuesFile,
  valuesRoots,
} from '../../lib/valuesFile';

describe('values_file of the form render tools', () => {
  const OLD = process.env.MCP_OUTPUT_DIR;
  let base: string;
  let work: string;
  let out: string;
  let outside: string;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-values-'));
    work = path.join(base, '.sc4sap', 'work', 'DEV1');
    out = path.join(work, 'mcp-output');
    fs.mkdirSync(out, { recursive: true });
    process.env.MCP_OUTPUT_DIR = out;
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-values-out-'));
  });
  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    if (OLD === undefined) delete process.env.MCP_OUTPUT_DIR;
    else process.env.MCP_OUTPUT_DIR = OLD;
  });

  it('reads a JSON object inside the output dir or the profile work folder', () => {
    fs.writeFileSync(path.join(out, 'v.json'), '{"A":1}');
    fs.mkdirSync(path.join(work, 'adobe', 'F'), { recursive: true });
    fs.writeFileSync(
      path.join(work, 'adobe', 'F', 'values.json'),
      '{"B":[1,2]}',
    );
    expect(readValuesFile('v.json')).toEqual({ A: 1 });
    expect(
      readValuesFile(path.join(work, 'adobe', 'F', 'values.json')),
    ).toEqual({ B: [1, 2] });
    expect(valuesRoots()).toHaveLength(2);
  });

  it('refuses a path outside, a ../ path and a link that leads out', () => {
    fs.writeFileSync(path.join(outside, 'v.json'), '{"A":1}');
    expect(() => readValuesFile(path.join(outside, 'v.json'))).toThrow(
      /no such .json file inside/,
    );
    expect(() =>
      readValuesFile(path.relative(out, path.join(outside, 'v.json'))),
    ).toThrow(/no such .json file inside/);
    expect(() => readValuesFile('../../../../x.json')).toThrow(/values_file/);
    fs.symlinkSync(
      outside,
      path.join(out, 'link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(() => readValuesFile('link/v.json')).toThrow(
      /no such .json file inside/,
    );
  });

  it('answers a missing file and an outside file alike (no existence oracle)', () => {
    fs.writeFileSync(path.join(outside, 'there.json'), '{"A":1}');
    const msg = (p: string) => {
      try {
        readValuesFile(p);
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    };
    const existing = msg(path.join(outside, 'there.json'));
    expect(existing).toBe(msg(path.join(outside, 'missing.json')));
    expect(existing).toBe(msg('missing-inside.json'));
  });

  it('refuses secret-looking names, UNC paths and non-JSON extensions before reading', () => {
    for (const p of [
      'sap.env.json',
      '.env.json',
      'profiles/x.json',
      'config.json',
      'keychain.json',
      'my-token.json',
      'credentials.json',
      'secret.json',
      'password.json',
    ]) {
      expect(() => readValuesFile(p)).toThrow(/secret or profile/);
    }
    expect(() => readValuesFile('\\\\server\\share\\v.json')).toThrow(/UNC/);
    expect(() => readValuesFile('//server/share/v.json')).toThrow(/UNC/);
    fs.writeFileSync(path.join(out, 'sap.txt'), 'SAP_PASSWORD=x');
    expect(() => readValuesFile('sap.txt')).toThrow(/\.json file is expected/);
  });

  it('never shows the file content in a parse error and caps the size', () => {
    fs.writeFileSync(path.join(out, 'bad.json'), 'SAP_PASSWORD=very-secret');
    let msg = '';
    try {
      readValuesFile('bad.json');
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toBe('values_file is not valid JSON');
    expect(msg).not.toMatch(/SAP_PASS|secret/);
    fs.writeFileSync(path.join(out, 'arr.json'), '[1,2]');
    expect(() => readValuesFile('arr.json')).toThrow(/JSON object/);
    fs.writeFileSync(
      path.join(out, 'big.json'),
      `{"A":"${'x'.repeat(MAX_VALUES_BYTES)}"}`,
    );
    expect(() => readValuesFile('big.json')).toThrow(/larger than/);
  });
});
