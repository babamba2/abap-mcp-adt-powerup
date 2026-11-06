import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { sqlResultToFile } from '../../handlers/system/readonly/handleGetSqlQuery';

describe('GetSqlQuery output: "file"', () => {
  const prev = process.env.MCP_OUTPUT_DIR;
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlout-'));
    process.env.MCP_OUTPUT_DIR = dir;
  });
  afterEach(() => {
    process.env.MCP_OUTPUT_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the parsed rows under sql/ and returns a summary only', () => {
    const parsed = {
      sql_query:
        "SELECT TABNAME, FIELDNAME FROM DD03L WHERE TABNAME IN ('ZA','ZB')",
      row_number: 100,
      columns: [
        { name: 'TABNAME', type: 'C' },
        { name: 'FIELDNAME', type: 'C' },
      ],
      rows: [
        { TABNAME: 'ZA', FIELDNAME: 'F1' },
        { TABNAME: 'ZB', FIELDNAME: 'F2' },
      ],
      truncated: false,
      path: 'ecc-dispatch-table-read',
    };
    const s = sqlResultToFile(parsed);
    expect(s.output).toBe('file');
    expect(s.rows).toBe(2);
    expect(s.columns).toEqual(['TABNAME', 'FIELDNAME']);
    expect(s.source_path).toBe('ecc-dispatch-table-read');
    expect(s.path.startsWith(path.join(dir, 'sql'))).toBe(true);
    expect(path.basename(s.path)).toMatch(/^dd03l-\d+-[a-z0-9]+\.json$/);
    expect(JSON.parse(fs.readFileSync(s.path, 'utf8')).rows).toHaveLength(2);
    expect(s).not.toHaveProperty('rows_data');
  });
});
