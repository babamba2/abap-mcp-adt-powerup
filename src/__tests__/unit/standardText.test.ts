/**
 * Unit tests for GetStandardText (lib/smartFormContent getStandardText): SSF_CONTENT part STDTEXT with text
 * object TEXT only, input checks before any call, and the DEV-only tier guard. The dispatcher is mocked.
 */

const callDispatch = jest.fn();
jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: (...args: unknown[]) => callDispatch(...args),
  getBackend: () => 'odata',
}));

import { checkToolAllowed } from '../../lib/readonlyGuard';
import { getStandardText } from '../../lib/smartFormContent';

beforeEach(() => callDispatch.mockReset());

describe('GetStandardText', () => {
  it('reads a TEXT / ST standard text through SSF_CONTENT STDTEXT', async () => {
    callDispatch.mockResolvedValue({
      result: {
        object: 'TEXT',
        name: 'SAMPLE-TEXT',
        id: 'ST',
        language: 'E',
        lines: [
          { f: '* ', l: 'First invented line   ' },
          { f: '/', l: 'Second line' },
        ],
      },
    });
    const r = await getStandardText({} as any, ' SAMPLE-TEXT ', 'st', 'e');
    const [, action, params] = callDispatch.mock.calls[0];
    expect(action).toBe('SSF_CONTENT');
    expect(params).toEqual({
      part: 'STDTEXT',
      object: 'TEXT',
      name: 'SAMPLE-TEXT',
      id: 'ST',
      language: 'E',
    });
    expect(r).toEqual({
      object: 'TEXT',
      name: 'SAMPLE-TEXT',
      id: 'ST',
      language: 'E',
      lines: [
        { format: '*', text: 'First invented line' },
        { format: '/', text: 'Second line' },
      ],
    });
  });

  it('refuses wildcards, bad ids and ISO language codes before any call', async () => {
    for (const [n, i, l] of [
      ['', 'ST', ''],
      ['SAMPLE*', 'ST', ''],
      ['A'.repeat(71), 'ST', ''],
      ['SAMPLE', 'S T', ''],
      ['SAMPLE', 'ST', 'EN'],
    ])
      await expect(getStandardText({} as any, n, i, l)).rejects.toThrow();
    expect(callDispatch).not.toHaveBeenCalled();
  });

  it('is allowed on DEV profiles only', () => {
    expect(checkToolAllowed('GetStandardText', 'DEV')).toBeNull();
    expect(checkToolAllowed('GetStandardText', 'QA')).toMatch(
      /DEV profiles only/,
    );
    expect(checkToolAllowed('GetStandardText', 'PRD')).toMatch(
      /DEV profiles only/,
    );
  });
});
