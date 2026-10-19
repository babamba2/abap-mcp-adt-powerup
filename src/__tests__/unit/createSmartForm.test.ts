import * as zlib from 'node:zlib';
import { uploadParts } from '../../handlers/smartform/high/handleCreateSmartForm';

describe('CreateSmartForm uploadParts', () => {
  it('splits the deflated XML into base64 parts that join back to the XML', () => {
    // varied content (repeated text would deflate into a single part)
    let seed = 7;
    const rnd = () => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    const items = Array.from(
      { length: 3000 },
      (_, i) =>
        `<item n="${i}">${rnd().toString(36)} 견본 ${rnd().toString(16)}</item>`,
    ).join('');
    const xml = Buffer.from(
      `<?xml version="1.0" encoding="utf-8"?><sf:SMARTFORM>${items}</sf:SMARTFORM>`,
    );
    const parts = uploadParts(xml, 5000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 5000)).toBe(true);
    const back = zlib.inflateRawSync(Buffer.from(parts.join(''), 'base64'));
    expect(back.equals(xml)).toBe(true);
  });

  it('keeps one part for a small form', () => {
    expect(uploadParts(Buffer.from('<x/>'))).toHaveLength(1);
  });
});
