/**
 * The masking key file is restricted to its owner: mode 600 on POSIX, an owner-only ACL
 * (icacls, inheritance removed) on Windows. On a Windows test machine the real ACL is checked.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('../../lib/profile', () => ({ getActiveAlias: () => 'ACL-TEST' }));

import {
  hardenKeyFile,
  loadMaskSecret,
  maskSecretPath,
  resetHardenedForTests,
  windowsAccount,
} from '../../lib/policy/maskSecret';

describe('owner-only key file', () => {
  it('runs icacls reset → inheritance removed + owner → verifies one owner entry on Windows', () => {
    const exec = jest.fn((_cmd: string, args: string[]) =>
      args.length === 1
        ? 'C:\\k\\mask.key DOM\\alice:(F)\r\n\r\nSuccessfully processed 1 files'
        : '',
    );
    hardenKeyFile('C:\\k\\mask.key', 'win32', exec as any, 'DOM\\alice');
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ['C:\\k\\mask.key', '/reset'],
      ['C:\\k\\mask.key', '/inheritance:r', '/grant:r', 'DOM\\alice:F'],
      ['C:\\k\\mask.key'],
    ]);
  });

  it('refuses the key when other entries remain after icacls', () => {
    const exec = jest.fn((_cmd: string, args: string[]) =>
      args.length === 1
        ? 'C:\\k\\mask.key NT AUTHORITY\\SYSTEM:(F)\r\n               DOM\\alice:(F)\r\n'
        : '',
    );
    expect(() =>
      hardenKeyFile('C:\\k\\mask.key', 'win32', exec as any, 'DOM\\alice'),
    ).toThrow(/could not be restricted to its owner/);
  });

  it('names the reason: entry count, or an owner name that differs (Azure AD / Microsoft account)', () => {
    const two = jest.fn((_c: string, args: string[]) =>
      args.length === 1
        ? 'C:\\k\\mask.key BUILTIN\\Administrators:(F)\r\n DOM\\alice:(F)\r\n'
        : '',
    );
    expect(() =>
      hardenKeyFile('C:\\k\\mask.key', 'win32', two as any, 'DOM\\alice'),
    ).toThrow(/2 access entries remain instead of 1/);
    const other = jest.fn((_c: string, args: string[]) =>
      args.length === 1 ? 'C:\\k\\mask.key AzureAD\\AliceKim:(F)\r\n' : '',
    );
    expect(() =>
      hardenKeyFile('C:\\k\\mask.key', 'win32', other as any, 'DOM\\alice'),
    ).toThrow(/not DOM\\alice — on an Azure AD or Microsoft-account sign-in/);
    const broken = jest.fn(() => {
      throw new Error('x');
    });
    expect(() =>
      hardenKeyFile('C:\\k\\mask.key', 'win32', broken as any, 'DOM\\alice'),
    ).toThrow(/icacls did not run/);
  });

  it('does nothing elsewhere (mode 600 is set at creation)', () => {
    const exec = jest.fn();
    hardenKeyFile('/k/mask.key', 'linux', exec as any, 'alice');
    expect(exec).not.toHaveBeenCalled();
  });

  it('refuses to use the key when icacls fails', () => {
    const exec = jest.fn(() => {
      throw new Error('access denied');
    });
    expect(() =>
      hardenKeyFile('C:\\k\\mask.key', 'win32', exec as any, 'alice'),
    ).toThrow(/could not be restricted to its owner/);
  });

  it('grants DOMAIN\\user when the domain is known', () => {
    expect(windowsAccount({ USERDOMAIN: 'SHP' }, 'pssps')).toBe('SHP\\pssps');
    expect(windowsAccount({}, 'pssps')).toBe('pssps');
  });

  const onWindows = process.platform === 'win32' ? it : it.skip;
  onWindows(
    'a key created on Windows ends with the owner as the only ACL entry',
    () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mask-acl-'));
      const prev = process.env.SC4SAP_HOME_DIR;
      process.env.SC4SAP_HOME_DIR = home;
      try {
        resetHardenedForTests();
        loadMaskSecret();
        const file = maskSecretPath();
        const acl = execFileSync('icacls', [file], { encoding: 'utf8' });
        const entries = acl
          .split(/\r?\n/)
          .map((l) => l.replace(file, '').trim())
          .filter((l) => /:\(/.test(l));
        expect(entries).toHaveLength(1);
        expect(entries[0].toLowerCase()).toContain(
          os.userInfo().username.toLowerCase(),
        );
        expect(entries[0]).toMatch(/\(F\)/);
      } finally {
        process.env.SC4SAP_HOME_DIR = prev;
        fs.rmSync(home, { recursive: true, force: true });
      }
    },
  );
});
