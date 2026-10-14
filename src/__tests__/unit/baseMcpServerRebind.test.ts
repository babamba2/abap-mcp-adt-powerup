/**
 * BaseMcpServer.rebindToProfile — the stdio server must follow ReloadProfile
 * instead of staying on the system whose credentials it captured at boot.
 */

import { BaseMcpServer } from '../../server/BaseMcpServer';

class TestServer extends BaseMcpServer {
  constructor() {
    super({ name: 'test' });
  }
  setContext(ctx: any) {
    this.connectionContext = ctx;
    (this as any).cachedConnection = { stale: true };
  }
  context() {
    return this.connectionContext;
  }
  cached() {
    return (this as any).cachedConnection;
  }
  rebind(loaded: any) {
    return this.rebindToProfile(loaded);
  }
}

const bootContext = {
  sessionId: 'default',
  connectionParams: {
    url: 'http://old-host:8010',
    authType: 'basic',
    username: 'OLDUSER',
    password: 'old',
    client: '300',
  },
  metadata: {
    destination: 'default',
    masterSystem: 'OLD',
    responsible: 'OLDUSER',
  },
};

function profile(envVars: Record<string, string>) {
  return { alias: 'NEW', envVars, tier: 'DEV', readonly: false, legacy: false };
}

describe('BaseMcpServer.rebindToProfile', () => {
  it('replaces basic-auth params, drops the cached connection and old system metadata', () => {
    const s = new TestServer();
    s.setContext(bootContext);
    const ok = s.rebind(
      profile({
        SAP_URL: 'http://new-host:8055',
        SAP_CLIENT: '560',
        SAP_USERNAME: 'NEWUSER',
        SAP_PASSWORD: 'new',
      }),
    );
    expect(ok).toBe(true);
    expect(s.context()?.connectionParams).toEqual({
      url: 'http://new-host:8055',
      authType: 'basic',
      username: 'NEWUSER',
      password: 'new',
      client: '560',
    });
    // Same stdio session id, so getConnection() keeps caching per process.
    expect(s.context()?.sessionId).toBe('default');
    expect(s.context()?.metadata?.destination).toBe('default');
    expect(s.context()?.metadata?.masterSystem).toBeUndefined();
    expect(s.context()?.metadata?.responsible).toBeUndefined();
    expect(s.cached()).toBeNull();
  });

  it('uses SAP_JWT_TOKEN when the profile is jwt-authenticated', () => {
    const s = new TestServer();
    s.setContext(bootContext);
    expect(
      s.rebind(
        profile({
          SAP_URL: 'https://cloud',
          SAP_AUTH_TYPE: 'jwt',
          SAP_JWT_TOKEN: 'tok',
        }),
      ),
    ).toBe(true);
    expect(s.context()?.connectionParams).toEqual({
      url: 'https://cloud',
      authType: 'jwt',
      jwtToken: 'tok',
      client: '',
    });
  });

  it('leaves the context untouched when the profile has no usable credentials', () => {
    const s = new TestServer();
    s.setContext(bootContext);
    expect(s.rebind(profile({ SAP_URL: 'http://new-host:8055' }))).toBe(false);
    expect(s.context()).toBe(bootContext);
    expect(s.cached()).toEqual({ stale: true });
  });

  it('returns false before any context was set', () => {
    expect(new TestServer().rebind(profile({ SAP_URL: 'x' }))).toBe(false);
  });
});
