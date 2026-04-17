import { parseActivationResults } from '../../lib/localGroupActivation';

// Minimal response shape from /sap/bc/adt/activation/results/{id}.
// Two objects: one include that activated cleanly, one with an error pointing
// at its href (line + col encoded in the fragment).
const multiObjectXml = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true" generationExecuted="true"/>
  <chkl:msg type="E" line="1" href="/sap/bc/adt/programs/includes/zmcp_inc02#start=17,10;end=17,20">
    <chkl:shortText>
      <chkl:txt>Statement is not defined. Please check your spelling.</chkl:txt>
    </chkl:shortText>
  </chkl:msg>
  <chkl:msg type="W" href="/sap/bc/adt/programs/includes/zmcp_inc01#start=3,1">
    <chkl:shortText>
      <chkl:txt>Obsolete statement</chkl:txt>
    </chkl:shortText>
  </chkl:msg>
</chkl:messages>`;

const cleanXml = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true" generationExecuted="true"/>
</chkl:messages>`;

const inputs = [
  {
    name: 'ZMCP_INC01',
    type: 'PROG/I',
    uri: '/sap/bc/adt/programs/includes/zmcp_inc01',
  },
  {
    name: 'ZMCP_INC02',
    type: 'PROG/I',
    uri: '/sap/bc/adt/programs/includes/zmcp_inc02',
  },
];

describe('parseActivationResults', () => {
  it('marks all objects activated when the response carries no errors', () => {
    const result = parseActivationResults(cleanXml, inputs);
    expect(result.activated).toBe(true);
    expect(result.checked).toBe(true);
    expect(result.generated).toBe(true);
    expect(result.errors).toEqual([]);
    for (const o of result.objects) {
      expect(o.status).toBe('activated');
    }
  });

  it('attributes messages to the right object by href prefix match', () => {
    const result = parseActivationResults(multiObjectXml, inputs);
    const inc1 = result.objects.find((o) => o.name === 'ZMCP_INC01')!;
    const inc2 = result.objects.find((o) => o.name === 'ZMCP_INC02')!;
    expect(inc1.errors).toHaveLength(0);
    expect(inc1.warnings).toHaveLength(1);
    expect(inc1.warnings[0].line).toBe('3');
    expect(inc1.status).toBe('activated');
    expect(inc2.errors).toHaveLength(1);
    expect(inc2.errors[0].line).toBe('17');
    expect(inc2.errors[0].text).toMatch(/Statement is not defined/);
    expect(inc2.status).toBe('failed');
  });

  it('aggregates errors + warnings at the group level', () => {
    const result = parseActivationResults(multiObjectXml, inputs);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('survives empty input (no entries)', () => {
    const result = parseActivationResults('<chkl:messages/>', inputs);
    expect(result.activated).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.objects).toHaveLength(2);
    // Neither activated nor errored → status defaults to "failed" (not activated)
    for (const o of result.objects) {
      expect(o.status).toBe('failed');
    }
  });
});
