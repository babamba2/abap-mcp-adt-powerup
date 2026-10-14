import { LEGACY_LOCK_HINT, withLegacyLockHint } from '../../lib/legacyLockHint';

describe('withLegacyLockHint', () => {
  const saved = process.env.ABAP_RELEASE;
  afterEach(() => {
    if (saved === undefined) delete process.env.ABAP_RELEASE;
    else process.env.ABAP_RELEASE = saved;
  });

  const lockError =
    'Error: Resource /sap/bc/adt/oo/classes/zcl_x/source/main is not locked (invalid lock handle)';

  it('appends the hint on BASIS < 7.40', () => {
    process.env.ABAP_RELEASE = '731';
    expect(withLegacyLockHint(lockError)).toBe(
      `${lockError}\n\n${LEGACY_LOCK_HINT}`,
    );
    expect(
      withLegacyLockHint('423 ExceptionResourceInvalidLockHandle'),
    ).toContain(LEGACY_LOCK_HINT);
  });

  it('adds the hint only once', () => {
    process.env.ABAP_RELEASE = '731';
    const once = withLegacyLockHint(lockError);
    expect(withLegacyLockHint(once)).toBe(once);
  });

  it('leaves 7.40+ and unknown releases alone', () => {
    process.env.ABAP_RELEASE = '740';
    expect(withLegacyLockHint(lockError)).toBe(lockError);
    delete process.env.ABAP_RELEASE;
    expect(withLegacyLockHint(lockError)).toBe(lockError);
  });

  it('leaves other errors alone', () => {
    process.env.ABAP_RELEASE = '731';
    const other = 'Error: Object ZCL_X is locked by user DEVELOPER';
    expect(withLegacyLockHint(other)).toBe(other);
  });
});
