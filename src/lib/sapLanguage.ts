/**
 * ISO 639-1 code → 1-character SAP language key (T002-SPRAS) for the standard
 * languages. Text tables store the 1-character key, which is not always the
 * first letter of the ISO code (KO → 3, ZH → 1, DA → K).
 */
const ISO_TO_SAP: Record<string, string> = {
  AR: 'A',
  BG: 'W',
  CS: 'C',
  DA: 'K',
  DE: 'D',
  EL: 'G',
  EN: 'E',
  ES: 'S',
  ET: '9',
  FI: 'U',
  FR: 'F',
  HE: 'B',
  HR: '6',
  HU: 'H',
  IT: 'I',
  JA: 'J',
  KO: '3',
  LT: 'X',
  LV: 'Y',
  MS: '7',
  NL: 'N',
  NO: 'O',
  PL: 'L',
  PT: 'P',
  RO: '4',
  RU: 'R',
  SK: 'Q',
  SL: '5',
  SR: '0',
  SV: 'V',
  TH: '2',
  TR: 'T',
  UK: '8',
  ZF: 'M',
  ZH: '1',
};

/**
 * Converts a logon language setting (SAP_LANGUAGE) to the 1-character SAP key.
 * @param language 1-character SAP key ("E", "3") or 2-letter ISO code ("EN", "KO")
 * @returns the SAP key, or undefined when the value is empty or unknown
 */
export function sapLanguageKey(
  language: string | undefined,
): string | undefined {
  const raw = String(language ?? '').trim();
  // 1-character keys are case-sensitive (a few languages use lower-case keys)
  if (raw.length === 1) return raw;
  return ISO_TO_SAP[raw.toUpperCase()];
}
