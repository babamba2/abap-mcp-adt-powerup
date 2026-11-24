/**
 * Unit tests for DeleteAdobeForm (handlers/adobeform/high/handleDeleteAdobeForm):
 * input checks, dispatcher params (dry run vs confirm), install hint, refusals.
 * The dispatcher is mocked.
 */

const callDispatch = jest.fn();
jest.mock('../../lib/rfcBackend', () => ({
  callDispatch: (...args: unknown[]) => callDispatch(...args),
}));

import {
  FP_DELETE_INSTALL_HINT,
  handleDeleteAdobeForm,
} from '../../handlers/adobeform/high/handleDeleteAdobeForm';
import { checkToolAllowed } from '../../lib/readonlyGuard';

const ctx = { connection: {} as any, logger: undefined } as any;
const text = (r: any) => String(r?.content?.[0]?.text ?? '');

beforeEach(() => callDispatch.mockReset());

describe('DeleteAdobeForm — input checks (no SAP call)', () => {
  it.each([
    ['FP_TEST_00', 'INTERFACE'],
    ['', 'FORM'],
    ['ZSC4SAP AFM', 'FORM'],
    ['Z' + 'A'.repeat(30), 'FORM'],
  ])('refuses name %j', async (name, kind) => {
    const r = await handleDeleteAdobeForm(ctx, { name, kind });
    expect(r.isError).toBe(true);
    expect(callDispatch).not.toHaveBeenCalled();
  });

  it.each(['Z' + 'A'.repeat(29), 'Z/NS/FORM'])(
    'accepts edge name %j (30 chars, slash)',
    async (name) => {
      callDispatch.mockResolvedValue({
        result: {},
        subrc: 0,
        message: 'dry run',
      });
      const r = await handleDeleteAdobeForm(ctx, { name, kind: 'FORM' });
      expect(r.isError).toBeFalsy();
      expect(callDispatch).toHaveBeenCalledTimes(1);
    },
  );

  it('refuses an unknown kind', async () => {
    const r = await handleDeleteAdobeForm(ctx, {
      name: 'ZSC4SAP_AFM_EX01_IF',
      kind: 'LAYOUT',
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/kind must be FORM or INTERFACE/);
    expect(callDispatch).not.toHaveBeenCalled();
  });
});

describe('DeleteAdobeForm — dispatcher call', () => {
  it('is a dry run unless confirm is true', async () => {
    callDispatch.mockResolvedValue({
      result: {
        name: 'ZSC4SAP_AFM_EX01_IF',
        kind: 'INTERFACE',
        package: '$TMP',
        deleted: false,
      },
      subrc: 0,
      message: 'FP_DELETE: dry run',
    });
    const r = await handleDeleteAdobeForm(ctx, {
      name: ' zsc4sap_afm_ex01_if ',
      kind: 'interface',
    });
    expect(callDispatch).toHaveBeenCalledWith(ctx.connection, 'FP_DELETE', {
      name: 'ZSC4SAP_AFM_EX01_IF',
      kind: 'INTERFACE',
      confirm: '',
    });
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(text(r));
    expect(body).toMatchObject({
      deleted: false,
      package: '$TMP',
      message: 'FP_DELETE: dry run',
    });
  });

  it('passes confirm X only for confirm === true', async () => {
    callDispatch.mockResolvedValue({
      result: { deleted: true, tadirLeft: false },
      subrc: 0,
      message: 'deleted',
    });
    await handleDeleteAdobeForm(ctx, {
      name: 'ZSC4SAP_AFM_EX13',
      kind: 'FORM',
      confirm: true,
    });
    expect(callDispatch.mock.calls[0][2]).toEqual({
      name: 'ZSC4SAP_AFM_EX13',
      kind: 'FORM',
      confirm: 'X',
    });
    await handleDeleteAdobeForm(ctx, {
      name: 'ZSC4SAP_AFM_EX13',
      kind: 'FORM',
      confirm: 'true' as any,
    });
    expect(callDispatch.mock.calls[1][2].confirm).toBe('');
  });

  it('turns a missing SAP side into the install hint', async () => {
    callDispatch.mockRejectedValue(
      new Error(
        'ZMCP_ADT_DISPATCH error (action=FP_DELETE, subrc=8): Unknown action: FP_DELETE',
      ),
    );
    const r = await handleDeleteAdobeForm(ctx, {
      name: 'ZSC4SAP_AFM_EX01_IF',
      kind: 'INTERFACE',
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain(FP_DELETE_INSTALL_HINT);
  });

  it('passes a refusal through unchanged', async () => {
    const msg =
      'ZMCP_ADT_DISPATCH error (action=FP_DELETE, subrc=4): FP_DELETE: interface ZSC4SAP_AFM_EX13_IF is used by 1 form(s): ZSC4SAP_AFM_EX13 - delete those first';
    callDispatch.mockRejectedValue(new Error(msg));
    const r = await handleDeleteAdobeForm(ctx, {
      name: 'ZSC4SAP_AFM_EX13_IF',
      kind: 'INTERFACE',
      confirm: true,
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('used by 1 form(s): ZSC4SAP_AFM_EX13');
    expect(text(r)).not.toContain(FP_DELETE_INSTALL_HINT);
  });
});

describe('DeleteAdobeForm — tier guard', () => {
  it('runs on DEV only', () => {
    expect(checkToolAllowed('DeleteAdobeForm', 'DEV')).toBeNull();
    expect(checkToolAllowed('DeleteAdobeForm', 'QA')).toMatch(/./);
    expect(checkToolAllowed('DeleteAdobeForm', 'PRD')).toMatch(/./);
  });
});
