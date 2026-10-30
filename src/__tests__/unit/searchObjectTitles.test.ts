/**
 * SearchObject program titles — TRDIRT languages and title choice.
 * Standard programs carry 30–40 TRDIRT languages; reading them all under a row
 * cap left whole names without a row, so only logon + English are read.
 */

import {
  pickProgramTitle,
  titleLanguages,
} from '../../handlers/search/readonly/handleSearchObject';
import { sapLanguageKey } from '../../lib/sapLanguage';

describe('sapLanguageKey', () => {
  it('maps ISO codes whose SAP key is not the first letter', () => {
    expect(sapLanguageKey('KO')).toBe('3');
    expect(sapLanguageKey('zh')).toBe('1');
    expect(sapLanguageKey('DA')).toBe('K');
  });
  it('keeps a 1-character key as given and rejects unknown or empty values', () => {
    expect(sapLanguageKey('E')).toBe('E');
    expect(sapLanguageKey('3')).toBe('3');
    expect(sapLanguageKey('XX')).toBeUndefined();
    expect(sapLanguageKey('')).toBeUndefined();
    expect(sapLanguageKey(undefined)).toBeUndefined();
  });
});

describe('titleLanguages', () => {
  it('reads the logon language first, then English', () => {
    expect(titleLanguages('KO')).toEqual(['3', 'E']);
    expect(titleLanguages('DE')).toEqual(['D', 'E']);
  });
  it('reads English only for an English, unknown or missing logon language', () => {
    expect(titleLanguages('EN')).toEqual(['E']);
    expect(titleLanguages('XX')).toEqual(['E']);
    expect(titleLanguages(undefined)).toEqual(['E']);
  });
});

describe('pickProgramTitle', () => {
  const rows = [
    { sprsl: 'E', text: 'Financial Statements' },
    { sprsl: '3', text: '재무제표' },
  ];
  it('prefers the logon language', () => {
    expect(pickProgramTitle(rows, ['3', 'E'], new Set())).toBe('재무제표');
  });
  it('falls back to a text the search response carried, then English', () => {
    const de = [
      { sprsl: 'E', text: 'Vendor Line Item Display' },
      { sprsl: 'X', text: 'Seen in search' },
    ];
    expect(pickProgramTitle(de, ['D', 'E'], new Set(['Seen in search']))).toBe(
      'Seen in search',
    );
    expect(pickProgramTitle(de, ['D', 'E'], new Set())).toBe(
      'Vendor Line Item Display',
    );
  });
  it('returns undefined without rows', () => {
    expect(pickProgramTitle([], ['E'], new Set())).toBeUndefined();
  });
});
