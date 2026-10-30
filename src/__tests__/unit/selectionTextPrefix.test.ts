/**
 * Selection-text ENTRY prefix — ENTRY(8) is reserved (pos 1 = 'D' for a DDIC
 * reference). ECC returns it; the S/4HANA RFC read drops the leading blanks
 * of a non-DDIC row, so read and merge only touch a prefix that is there.
 */

import { splitSelectionEntry } from '../../handlers/text_element/high/handleReadTextElementsBulk';
import { restoreSelectionPrefix } from '../../handlers/text_element/high/handleWriteTextElementsBulk';

describe('splitSelectionEntry', () => {
  it('removes the 8-character prefix and reads the DDIC flag', () => {
    expect(splitSelectionEntry('        Company code worklist')).toEqual({
      text: 'Company code worklist',
      ddic_reference: false,
    });
    expect(splitSelectionEntry('D       Net due date')).toEqual({
      text: 'Net due date',
      ddic_reference: true,
    });
  });
  it('keeps a row that came without the prefix', () => {
    expect(splitSelectionEntry('Company code worklist')).toEqual({
      text: 'Company code worklist',
      ddic_reference: false,
    });
    expect(splitSelectionEntry('Layout')).toEqual({
      text: 'Layout',
      ddic_reference: false,
    });
  });
});

describe('restoreSelectionPrefix', () => {
  const row = (ID: string, ENTRY: string) => ({
    ID,
    KEY: 'P_X',
    ENTRY,
    LENGTH: ENTRY.length,
  });
  it('restores the prefix on an S row that lost it', () => {
    expect(restoreSelectionPrefix(row('S', 'Layout'))).toEqual(
      row('S', '        Layout'),
    );
  });
  it('leaves prefixed S rows and other types alone', () => {
    const ddic = row('S', 'D       Net due date');
    expect(restoreSelectionPrefix(ddic)).toBe(ddic);
    const sym = row('I', 'Layout');
    expect(restoreSelectionPrefix(sym)).toBe(sym);
  });
});
