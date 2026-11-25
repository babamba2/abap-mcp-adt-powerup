/**
 * CreateProgram error text keeps SAP's reason (step, status, body) instead of
 * a bare "Request failed with status code 403".
 */
import { describeCreateError } from '../../handlers/program/high/handleCreateProgram';

function axiosError(status: number, data: unknown, headers = {}) {
  const e: any = new Error(`Request failed with status code ${status}`);
  e.response = { status, data, headers };
  return e;
}

describe('describeCreateError', () => {
  it('returns the ADT exception message with step and status', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><message lang="EN">You are not authorized to create objects in package ZSD000</message></exc:exception>';
    expect(describeCreateError(axiosError(403, xml), 'create')).toBe(
      '[create] HTTP 403: SAP Error: You are not authorized to create objects in package ZSD000',
    );
  });

  it('flags a CSRF rejection when the 403 body is empty', () => {
    const text = describeCreateError(
      axiosError(403, '', { 'x-csrf-token': 'required' }),
      'create',
    );
    expect(text).toMatch(/^\[create\] HTTP 403: /);
    expect(text).toContain('CSRF token rejected');
  });

  it('gives no CSRF hint for a token value or another status', () => {
    expect(
      describeCreateError(
        axiosError(403, 'No authorization', { 'x-csrf-token': 'abc123' }),
        'create',
      ),
    ).toBe('[create] HTTP 403: No authorization');
    expect(
      describeCreateError(
        axiosError(500, 'boom', { 'x-csrf-token': 'Required' }),
        'create',
      ),
    ).toBe('[create] HTTP 500: boom');
  });

  it('reduces an HTML error page to its text', () => {
    const html =
      '<html><head><title>403 Forbidden</title><style>p{}</style></head><body><h1>Forbidden</h1><p>Access denied by ICM</p></body></html>';
    expect(describeCreateError(axiosError(403, html), 'create')).toBe(
      '[create] HTTP 403: 403 Forbidden Forbidden Access denied by ICM',
    );
  });

  it('names the step for a validate error the client already wrapped', () => {
    expect(
      describeCreateError(
        new Error('Validation failed: Request failed with status code 403'),
        'validate',
      ),
    ).toBe('[validate] Validation failed: Request failed with status code 403');
  });

  it('keeps a plain-text body', () => {
    expect(
      describeCreateError(
        axiosError(400, 'Package ZX does not exist'),
        'create',
      ),
    ).toBe('[create] HTTP 400: Package ZX does not exist');
  });

  it('reduces exception XML inside a wrapped validate error to its message', () => {
    const wrapped = new Error(
      'Validation failed: <?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="InvalidProgramName"/><message lang="EN">ZSC4SAP_X already exists</message></exc:exception>',
    );
    expect(describeCreateError(wrapped, 'validate')).toBe(
      '[validate] Validation failed: SAP Error: ZSC4SAP_X already exists',
    );
  });

  it('decodes XML entities in the wrapped exception message', () => {
    const wrapped = new Error(
      'Validation failed: <exc:exception xmlns:exc="x"><message lang="EN">Program &quot;ZX&quot; &amp; &#228; &#x41; &#99999999;</message></exc:exception>',
    );
    expect(describeCreateError(wrapped, 'validate')).toBe(
      '[validate] Validation failed: SAP Error: Program "ZX" & ä A &#99999999;',
    );
  });

  it('keeps the original text when the exception message is empty', () => {
    const text =
      'Validation failed: <exc:exception xmlns:exc="x"><message lang="EN"></message></exc:exception>';
    expect(describeCreateError(new Error(text), 'validate')).toBe(
      `[validate] ${text}`,
    );
  });

  it('caps a long wrapped error at 2000 characters', () => {
    const out = describeCreateError(new Error('x'.repeat(5000)), 'create');
    expect(out).toBe(`[create] ${'x'.repeat(2000)}`);
  });

  it('keeps the text of non-HTTP errors and names the step', () => {
    expect(describeCreateError(new Error('socket hang up'), 'create')).toBe(
      '[create] socket hang up',
    );
  });
});
