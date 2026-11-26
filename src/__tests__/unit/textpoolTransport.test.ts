/**
 * Unit tests for recordTextpoolTransport: LIMU REPT is recorded through the
 * dispatcher action TEXTPOOL_CORR before a text pool write. The dispatcher
 * call is mocked; request numbers are invented.
 */

import { recordTextpoolTransport } from '../../lib/textpoolTransport';

const connection = {} as any;

function dispatchReturning(result: any) {
  return jest.fn(async () => ({ result, subrc: 0, message: '' }));
}

function dispatchFailing(message: string) {
  return jest.fn(async () => {
    throw new Error(message);
  });
}

describe('recordTextpoolTransport', () => {
  it('records on the request and passes program / request upper case', async () => {
    const dispatch = dispatchReturning({ korrnum: 'DEVK900102', local: false });
    const info = await recordTextpoolTransport(
      connection,
      'zprog',
      ' devk900101 ',
      dispatch as any,
    );
    expect(dispatch).toHaveBeenCalledWith(connection, 'TEXTPOOL_CORR', {
      program: 'ZPROG',
      transport: 'DEVK900101',
    });
    expect(info).toEqual({
      recorded: true,
      korrnum: 'DEVK900102',
      local: false,
    });
  });

  it('reports a local ($) program as not recorded, no error', async () => {
    const dispatch = dispatchReturning({ korrnum: '', local: true });
    const info = await recordTextpoolTransport(
      connection,
      'ZPROG',
      undefined,
      dispatch as any,
    );
    expect(info).toEqual({ recorded: false, korrnum: '', local: true });
  });

  it('stops the write when SAP refuses to record', async () => {
    const dispatch = dispatchFailing(
      'ZMCP_ADT_DISPATCH error (action=TEXTPOOL_CORR, subrc=4): Transport request required: program ZPROG is in package ZPKG',
    );
    await expect(
      recordTextpoolTransport(connection, 'ZPROG', '', dispatch as any),
    ).rejects.toThrow(/not written.*Transport request required/);
  });

  it('stops the write when a request is given but the dispatcher is too old', async () => {
    const dispatch = dispatchFailing(
      'ZMCP_ADT_DISPATCH error (action=TEXTPOOL_CORR, subrc=4): Unknown action: TEXTPOOL_CORR',
    );
    await expect(
      recordTextpoolTransport(
        connection,
        'ZPROG',
        'DEVK900101',
        dispatch as any,
      ),
    ).rejects.toThrow(/no TEXTPOOL_CORR action.*DEVK900101/);
  });

  it('warns but lets the write go when no request is given and the dispatcher is too old', async () => {
    const dispatch = dispatchFailing(
      'ZMCP_ADT_DISPATCH error (action=TEXTPOOL_CORR, subrc=4): Unknown action: TEXTPOOL_CORR',
    );
    const info = await recordTextpoolTransport(
      connection,
      'ZPROG',
      undefined,
      dispatch as any,
    );
    expect(info.recorded).toBe(false);
    expect(info.local).toBe(false);
    expect(info.warning).toMatch(/not on any transport request/);
  });
});
