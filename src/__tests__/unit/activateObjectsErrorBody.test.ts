/**
 * ActivateObjects must surface SAP's response body on HTTP errors.
 * A bare "Request failed with status code 500" hid why activation failed
 * (HKT-DEV 2026-11-19, include + master programs left locked).
 */
import { handleActivateObjects } from '../../handlers/common/high/handleActivateObjects';
import { activateObjectsLocal } from '../../lib/localGroupActivation';

jest.mock('../../lib/localGroupActivation', () => ({
  activateObjectsLocal: jest.fn(),
}));

function httpError(status: number, data: string): any {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
}

function textOf(result: any): string {
  return (result?.content ?? []).map((c: any) => c.text ?? '').join('\n');
}

const args = { objects: [{ name: 'ZTEST_INC', type: 'PROG/I' }] };

describe('ActivateObjects error body', () => {
  it('returns the exc:exception message and the HTTP status', async () => {
    (activateObjectsLocal as jest.Mock).mockRejectedValueOnce(
      httpError(
        500,
        '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><message lang="EN">ZTEST_INC is locked by user TESTUSER</message></exc:exception>',
      ),
    );
    const result: any = await handleActivateObjects(
      { connection: {} as any, logger: undefined } as any,
      args,
    );
    const text = textOf(result);
    expect(result.isError).toBe(true);
    expect(text).toContain('[500]');
    expect(text).toContain('ZTEST_INC is locked by user TESTUSER');
  });

  it('returns the raw body when there is no exc:exception', async () => {
    (activateObjectsLocal as jest.Mock).mockRejectedValueOnce(
      httpError(403, 'Object is being edited in another session'),
    );
    const result: any = await handleActivateObjects(
      { connection: {} as any, logger: undefined } as any,
      args,
    );
    const text = textOf(result);
    expect(text).toContain('[403]');
    expect(text).toContain('Object is being edited in another session');
  });

  it('falls back to error.message without a response', async () => {
    (activateObjectsLocal as jest.Mock).mockRejectedValueOnce(
      new Error('socket hang up'),
    );
    const result: any = await handleActivateObjects(
      { connection: {} as any, logger: undefined } as any,
      args,
    );
    expect(textOf(result)).toContain('socket hang up');
  });
});
