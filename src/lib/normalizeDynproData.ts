/**
 * Normalize dynpro_data JSON keys for ABAP /ui2/cl_json=>deserialize compatibility.
 *
 * ABAP deserializes JSON keys by matching them to structure field names in UPPERCASE.
 * When callers pass lowercase or mixed-case keys (e.g., "metadata", "flow_logic"),
 * ABAP silently ignores them, causing HEADER-PROGRAM to be empty → TRDIR lookup
 * fails → RPY_DYNPRO_INSERT returns subrc=3.
 *
 * This function normalizes:
 *   - Top-level keys: metadata→HEADER, containers→CONTAINERS, etc.
 *   - HEADER sub-keys: all uppercased
 *   - FLOW_LOGIC: string with newlines → [{LINE:"..."}] array
 *   - Ensures HEADER.PROGRAM and HEADER.SCREEN are set from caller context
 */

/** Known key aliases: lowercase/mixed-case → canonical ABAP key */
const TOP_KEY_MAP: Record<string, string> = {
  header: 'HEADER',
  metadata: 'HEADER',
  containers: 'CONTAINERS',
  fields_to_containers: 'FIELDS_TO_CONTAINERS',
  flow_logic: 'FLOW_LOGIC',
  // Already correct forms pass through
  HEADER: 'HEADER',
  CONTAINERS: 'CONTAINERS',
  FIELDS_TO_CONTAINERS: 'FIELDS_TO_CONTAINERS',
  FLOW_LOGIC: 'FLOW_LOGIC',
};

/**
 * Recursively uppercase all keys in an object or array.
 */
function uppercaseKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(uppercaseKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key.toUpperCase()] = uppercaseKeys(value);
    }
    return result;
  }
  return obj;
}

/**
 * Convert flow_logic from string format to [{LINE:"..."}] array format.
 */
function normalizeFlowLogic(flowLogic: any): Array<{ LINE: string }> {
  if (typeof flowLogic === 'string') {
    return flowLogic.split('\n').map((line) => ({ LINE: line }));
  }
  if (Array.isArray(flowLogic)) {
    return flowLogic.map((entry) => {
      if (typeof entry === 'string') {
        return { LINE: entry };
      }
      if (entry && typeof entry === 'object') {
        // Normalize keys: line→LINE, Line→LINE
        const line = entry.LINE ?? entry.line ?? entry.Line ?? '';
        return { LINE: String(line) };
      }
      return { LINE: '' };
    });
  }
  return [];
}

/**
 * Normalize dynpro_data JSON for ABAP compatibility.
 *
 * @param dynproDataStr - Raw JSON string from caller (may have lowercase keys)
 * @param programName - Uppercase program name (fallback for HEADER.PROGRAM)
 * @param screenNumber - Screen number (fallback for HEADER.SCREEN)
 * @returns Normalized JSON string ready for ZMCP_ADT_DISPATCH
 */
export function normalizeDynproData(
  dynproDataStr: string,
  programName: string,
  screenNumber: string,
): string {
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(dynproDataStr);
  } catch {
    // Not valid JSON — return as-is, let ABAP handle the error
    return dynproDataStr;
  }

  const normalized: Record<string, any> = {};

  // Map top-level keys to canonical ABAP names
  for (const [key, value] of Object.entries(parsed)) {
    const canonicalKey = TOP_KEY_MAP[key] ?? key.toUpperCase();
    normalized[canonicalKey] = value;
  }

  // Normalize HEADER: uppercase all sub-keys
  if (normalized.HEADER && typeof normalized.HEADER === 'object') {
    normalized.HEADER = uppercaseKeys(normalized.HEADER);
  } else {
    normalized.HEADER = {};
  }

  // Ensure PROGRAM and SCREEN are always set
  if (!normalized.HEADER.PROGRAM) {
    normalized.HEADER.PROGRAM = programName;
  }
  if (!normalized.HEADER.SCREEN) {
    normalized.HEADER.SCREEN = screenNumber;
  }

  // Normalize CONTAINERS and FIELDS_TO_CONTAINERS: uppercase all keys
  if (normalized.CONTAINERS) {
    normalized.CONTAINERS = uppercaseKeys(normalized.CONTAINERS);
  }
  if (normalized.FIELDS_TO_CONTAINERS) {
    normalized.FIELDS_TO_CONTAINERS = uppercaseKeys(
      normalized.FIELDS_TO_CONTAINERS,
    );
  }

  // Normalize FLOW_LOGIC: string → [{LINE:"..."}] array
  if (normalized.FLOW_LOGIC !== undefined) {
    normalized.FLOW_LOGIC = normalizeFlowLogic(normalized.FLOW_LOGIC);
  }

  return JSON.stringify(normalized);
}
