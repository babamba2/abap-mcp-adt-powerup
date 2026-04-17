import {
  buildFeedQueryParams,
  parseAtomFeed,
  parseFeedDescriptors,
  parseFeedVariants,
  parseGatewayErrorDetail,
  parseGatewayErrors,
  parseHtmlSummaryTable,
  parseRuntimeDumpFeed,
  parseSystemMessages,
} from '../../handlers/system/readonly/runtimeFeedsHelper';

const feedsDescriptorsXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ADT Feeds</title>
  <entry>
    <id>runtime/dumps</id>
    <title>Runtime Dumps</title>
    <link href="/sap/bc/adt/runtime/dumps"/>
    <category term="feed"/>
  </entry>
  <entry>
    <id>runtime/systemmessages</id>
    <title>System Messages</title>
    <link href="/sap/bc/adt/runtime/systemmessages"/>
    <category term="feed"/>
  </entry>
</feed>`;

const variantsXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>var1</id>
    <title>Variant One</title>
    <link href="/sap/bc/adt/feeds/variants/v1"/>
  </entry>
</feed>`;

const dumpsFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>DUMPID123</id>
    <title type="text">Division by zero</title>
    <updated>2026-04-17T08:15:00Z</updated>
    <link href="/sap/bc/adt/runtime/dump/DUMPID123"/>
    <content>Short text content</content>
    <author><name>TESTUSER</name></author>
    <category term="ABAP Runtime Error"/>
  </entry>
</feed>`;

const systemMessagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:sm="http://www.sap.com/adt/sm">
  <entry>
    <id>SM_01</id>
    <title>Scheduled downtime</title>
    <content>System down from 22:00 to 02:00</content>
    <category term="warning"/>
    <author><name>BASIS</name></author>
    <sm:validFrom>20260418220000</sm:validFrom>
    <sm:validTo>20260419020000</sm:validTo>
    <updated>2026-04-17T10:00:00Z</updated>
  </entry>
</feed>`;

// Realistic GW Atom feed — the real ADT endpoint encodes the entry type in
// the atom:id prefix (FrontendError/…) and puts everything else in an HTML
// table inside <atom:summary>. No <category>, no gw:* extension elements.
const gatewayErrorsXml = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xml:lang="EN" xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:title>SAP Gateway Error Log</atom:title>
  <atom:entry>
    <atom:author><atom:name>SV5_000054 (Harish)</atom:name></atom:author>
    <atom:id>FrontendError/020000DD4A3B1FD18EC51E3F3BB1387C</atom:id>
    <atom:updated>2026-04-17T06:44:56Z</atom:updated>
    <atom:summary type="html">&lt;h4&gt;&lt;u&gt;Header Information&lt;/u&gt;&lt;/h4&gt;&lt;table&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Type&lt;/b&gt;&lt;/td&gt;&lt;td&gt; Frontend Error &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Short Text&lt;/b&gt;&lt;/td&gt;&lt;td&gt; &lt;span&gt;User has no authorization for operation READ on object MATDOC&lt;/span&gt; &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Transaction ID&lt;/b&gt;&lt;/td&gt;&lt;td&gt; C83CB3D2A14200C0E0069D216367C832&amp;nbsp;&lt;a href="#"&gt;(Replay in GW Client)&lt;/a&gt; &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Package&lt;/b&gt;&lt;/td&gt;&lt;td&gt; /IWFND/MGW_GSR_CORE &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Application Component&lt;/b&gt;&lt;/td&gt;&lt;td&gt; CA-DMS &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Date/Time&lt;/b&gt;&lt;/td&gt;&lt;td&gt; 04/17/2026 06:44:56 (System) &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Username&lt;/b&gt;&lt;/td&gt;&lt;td&gt; SV5_000054 (Harish) &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Client&lt;/b&gt;&lt;/td&gt;&lt;td&gt; 100 &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Request Kind&lt;/b&gt;&lt;/td&gt;&lt;td&gt; Server OData V2 &lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</atom:summary>
    <atom:link href="/sap/bc/adt/gw/errorlog/FrontendError/020000DD4A3B1FD18EC51E3F3BB1387C"/>
  </atom:entry>
</atom:feed>`;

// Realistic ST22 Atom feed — two <atom:category> (runtime error + program),
// <atom:published> for timestamp, and a rich HTML summary table with Program,
// Exception, User etc.
const runtimeDumpsXml = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:title>ABAP Short Dump Analysis</atom:title>
  <atom:entry xml:lang="EN">
    <atom:author FullName="SAP_SYSTEM"><atom:name>SAP_SYSTEM</atom:name></atom:author>
    <atom:category term="COMPUTE_INT_PLUS_OVERFLOW" label="ABAP runtime error"/>
    <atom:category term="/IWFND/CL_METERING_DB=========CP" label="Terminated ABAP program"/>
    <atom:id>/sap/bc/adt/vit/runtime/dumps/20260417031201vhcals4hci_S4H_00_SAP_SYSTEM_000_23</atom:id>
    <atom:link href="adt://S4H/sap/bc/adt/runtime/dump/20260417031201vhcals4hci_S4H_00_SAP_SYSTEM_000_23" rel="self" type="text/plain"/>
    <atom:published>2026-04-17T03:12:01Z</atom:published>
    <atom:summary type="html">&lt;table&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Short Text&lt;/b&gt;&lt;/td&gt;&lt;td&gt; Integer overflow during addition (type I or INT8) &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Runtime Error&lt;/b&gt;&lt;/td&gt;&lt;td&gt; COMPUTE_INT_PLUS_OVERFLOW &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Exception&lt;/b&gt;&lt;/td&gt;&lt;td&gt; CX_SY_ARITHMETIC_OVERFLOW &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Program&lt;/b&gt;&lt;/td&gt;&lt;td&gt; /IWFND/CL_METERING_DB=========CP &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Application Component&lt;/b&gt;&lt;/td&gt;&lt;td&gt; OPU-FND-CS &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Date/Time&lt;/b&gt;&lt;/td&gt;&lt;td&gt; 04/17/2026 03:12:01 (System) &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;User&lt;/b&gt;&lt;/td&gt;&lt;td&gt; SAP_SYSTEM (SAP_SYSTEM) &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Client&lt;/b&gt;&lt;/td&gt;&lt;td&gt; 000 &lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Host&lt;/b&gt;&lt;/td&gt;&lt;td&gt; vhcals4hci_S4H_00 &lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</atom:summary>
  </atom:entry>
</atom:feed>`;

const gatewayErrorDetailXml = `<?xml version="1.0" encoding="UTF-8"?>
<errorlog:errorEntry
  xmlns:errorlog="http://www.sap.com/adt/gw/errorlog"
  type="Frontend Error">
  <errorlog:shortText>Division by zero</errorlog:shortText>
  <errorlog:transactionId>GW_TX_42</errorlog:transactionId>
  <errorlog:package>ZBILLING</errorlog:package>
  <errorlog:applicationComponent>SD-BIL</errorlog:applicationComponent>
  <errorlog:dateTime>2026-04-17T11:20:00Z</errorlog:dateTime>
  <errorlog:username>JSMITH</errorlog:username>
  <errorlog:client>100</errorlog:client>
  <errorlog:requestKind>GET</errorlog:requestKind>
  <errorlog:serviceInfo
    namespace="sap"
    serviceName="ZBILLING_SRV"
    serviceVersion="0001"
    groupId="GRP1"
    serviceRepository="LOCAL"
    destination=""/>
  <errorlog:errorContext>
    <errorlog:errorInfo>DB error during read</errorlog:errorInfo>
    <errorlog:exceptions>
      <errorlog:exception type="CX_SY_ZERODIVIDE" raiseLocation="ZCL_BILLING/BUILD_REPORT/42">
        Division by zero in billing report
      </errorlog:exception>
    </errorlog:exceptions>
  </errorlog:errorContext>
  <errorlog:sourceCode errorLine="42">
    <errorlog:line number="41"> lv_num = 1.</errorlog:line>
    <errorlog:line number="42" isError="true"> lv_res = lv_num / 0.</errorlog:line>
    <errorlog:line number="43"> WRITE lv_res.</errorlog:line>
  </errorlog:sourceCode>
  <errorlog:callStack>
    <errorlog:entry number="1" event="CALL" program="ZCL_BILLING" name="BUILD_REPORT" line="42"/>
    <errorlog:entry number="2" event="CALL" program="ZCL_DISPATCH" name="HANDLE_REQUEST" line="10"/>
  </errorlog:callStack>
</errorlog:errorEntry>`;

describe('runtimeFeedsHelper', () => {
  describe('buildFeedQueryParams', () => {
    it('returns empty string when no options given', () => {
      expect(buildFeedQueryParams()).toBe('');
      expect(buildFeedQueryParams({})).toBe('');
    });

    it('builds $query with default user attribute', () => {
      const q = buildFeedQueryParams({ user: 'JSMITH' });
      expect(q).toContain('%24query=');
      // URLSearchParams encodes spaces as '+', decodeURIComponent leaves '+' unchanged.
      const decoded = decodeURIComponent(q).replace(/\+/g, ' ');
      expect(decoded).toContain('equals ( user , JSMITH )');
    });

    it('switches user attribute (username for gateway)', () => {
      const q = buildFeedQueryParams({ user: 'JSMITH' }, 'username');
      const decoded = decodeURIComponent(q).replace(/\+/g, ' ');
      expect(decoded).toContain('equals ( username , JSMITH )');
    });

    it('adds $top when maxResults given', () => {
      const q = buildFeedQueryParams({ maxResults: 25 });
      expect(q).toContain('%24top=25');
    });

    it('adds from/to date range params', () => {
      const q = buildFeedQueryParams({
        from: '20260101000000',
        to: '20260201235959',
      });
      expect(q).toContain('from=20260101000000');
      expect(q).toContain('to=20260201235959');
    });

    it('trims whitespace in user filter', () => {
      const q = buildFeedQueryParams({ user: '  JSMITH  ' });
      const decoded = decodeURIComponent(q).replace(/\+/g, ' ');
      expect(decoded).toContain('equals ( user , JSMITH )');
    });
  });

  describe('parseFeedDescriptors', () => {
    it('parses descriptor entries', () => {
      const result = parseFeedDescriptors(feedsDescriptorsXml);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'runtime/dumps',
        title: 'Runtime Dumps',
        url: '/sap/bc/adt/runtime/dumps',
        category: 'feed',
      });
    });

    it('returns empty array for empty feed', () => {
      expect(parseFeedDescriptors('<feed></feed>')).toEqual([]);
    });
  });

  describe('parseFeedVariants', () => {
    it('parses variant entries', () => {
      const result = parseFeedVariants(variantsXml);
      expect(result).toEqual([
        {
          id: 'var1',
          title: 'Variant One',
          url: '/sap/bc/adt/feeds/variants/v1',
        },
      ]);
    });
  });

  describe('parseAtomFeed', () => {
    it('parses generic Atom feed entries', () => {
      const result = parseAtomFeed(dumpsFeedXml);
      expect(result).toHaveLength(1);
      const [entry] = result;
      expect(entry.id).toBe('DUMPID123');
      expect(entry.title).toBe('Division by zero');
      expect(entry.link).toBe('/sap/bc/adt/runtime/dump/DUMPID123');
      expect(entry.content).toBe('Short text content');
      expect(entry.author).toBe('TESTUSER');
      expect(entry.category).toBe('ABAP Runtime Error');
      expect(entry.updated).toBe('2026-04-17T08:15:00Z');
    });

    it('normalizes single-entry feed into array', () => {
      const single = `<feed><entry><id>only</id><title>t</title></entry></feed>`;
      const result = parseAtomFeed(single);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('only');
    });
  });

  describe('parseSystemMessages', () => {
    it('parses system message entries with severity and validity', () => {
      const result = parseSystemMessages(systemMessagesXml);
      expect(result).toHaveLength(1);
      const [msg] = result;
      expect(msg.id).toBe('SM_01');
      expect(msg.title).toBe('Scheduled downtime');
      expect(msg.text).toBe('System down from 22:00 to 02:00');
      expect(msg.severity).toBe('warning');
      expect(msg.validFrom).toBe('20260418220000');
      expect(msg.validTo).toBe('20260419020000');
      expect(msg.createdBy).toBe('BASIS');
    });
  });

  describe('parseHtmlSummaryTable', () => {
    it('extracts <b>Label</b></td><td>value</td> pairs keyed by lowercase label', () => {
      const html =
        '<table><tr><td><b>Program</b></td><td> /IWFND/CL_X </td></tr><tr><td><b>User</b></td><td> SAP_SYSTEM </td></tr></table>';
      const map = parseHtmlSummaryTable(html);
      expect(map.get('program')).toBe('/IWFND/CL_X');
      expect(map.get('user')).toBe('SAP_SYSTEM');
    });

    it('transparently decodes entity-escaped HTML (&lt;b&gt; ...)', () => {
      const escaped =
        '&lt;table&gt;&lt;tr&gt;&lt;td&gt;&lt;b&gt;Client&lt;/b&gt;&lt;/td&gt;&lt;td&gt; 100 &lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;';
      const map = parseHtmlSummaryTable(escaped);
      expect(map.get('client')).toBe('100');
    });

    it('strips inline span tags inside value cells', () => {
      const html =
        '<tr><td><b>Short Text</b></td><td> <span>Authorization denied</span> </td></tr>';
      const map = parseHtmlSummaryTable(html);
      expect(map.get('short text')).toBe('Authorization denied');
    });
  });

  describe('parseGatewayErrors', () => {
    it('derives type from atom:id prefix and extracts fields from HTML summary', () => {
      const result = parseGatewayErrors(gatewayErrorsXml);
      expect(result).toHaveLength(1);
      const [err] = result;
      expect(err.type).toBe('Frontend Error');
      expect(err.shortText).toBe(
        'User has no authorization for operation READ on object MATDOC',
      );
      expect(err.transactionId).toBe('C83CB3D2A14200C0E0069D216367C832');
      expect(err.username).toBe('SV5_000054 (Harish)');
      expect(err.package).toBe('/IWFND/MGW_GSR_CORE');
      expect(err.applicationComponent).toBe('CA-DMS');
      expect(err.client).toBe('100');
      expect(err.requestKind).toBe('Server OData V2');
      expect(err.dateTime).toBe('2026-04-17T06:44:56Z');
      expect(err.link).toBe(
        '/sap/bc/adt/gw/errorlog/FrontendError/020000DD4A3B1FD18EC51E3F3BB1387C',
      );
    });

    it('synthesizes a fetchable detail URL when atom:link is missing', () => {
      const withoutLink = gatewayErrorsXml.replace(/<atom:link[^>]*\/>/g, '');
      const [err] = parseGatewayErrors(withoutLink);
      // /sap/bc/adt/gw/errorlog/Frontend%20Error/{GUID}
      expect(err.link).toBe(
        '/sap/bc/adt/gw/errorlog/Frontend%20Error/020000DD4A3B1FD18EC51E3F3BB1387C',
      );
    });
  });

  describe('parseRuntimeDumpFeed', () => {
    it('returns enriched dump entries with program, user, exception from HTML summary', () => {
      const result = parseRuntimeDumpFeed(runtimeDumpsXml);
      expect(result).toHaveLength(1);
      const [d] = result;
      expect(d.dumpId).toBe(
        '20260417031201vhcals4hci_S4H_00_SAP_SYSTEM_000_23',
      );
      expect(d.published).toBe('2026-04-17T03:12:01Z');
      expect(d.runtimeError).toBe('COMPUTE_INT_PLUS_OVERFLOW');
      expect(d.exception).toBe('CX_SY_ARITHMETIC_OVERFLOW');
      expect(d.program).toBe('/IWFND/CL_METERING_DB=========CP');
      expect(d.user).toBe('SAP_SYSTEM (SAP_SYSTEM)');
      expect(d.client).toBe('000');
      expect(d.host).toBe('vhcals4hci_S4H_00');
      expect(d.shortText).toBe(
        'Integer overflow during addition (type I or INT8)',
      );
      expect(d.applicationComponent).toBe('OPU-FND-CS');
      expect(d.detailUrl).toBe(
        'adt://S4H/sap/bc/adt/runtime/dump/20260417031201vhcals4hci_S4H_00_SAP_SYSTEM_000_23',
      );
    });

    it('falls back to category term when HTML table lacks Program row', () => {
      const stripped = runtimeDumpsXml.replace(
        /Program&lt;\/b&gt;&lt;\/td&gt;&lt;td&gt;[^&]*/g,
        'Program&lt;/b&gt;&lt;/td&gt;&lt;td&gt;',
      );
      const [d] = parseRuntimeDumpFeed(stripped);
      // With the HTML Program row blanked, the category term fallback wins.
      expect(d.program).toBe('/IWFND/CL_METERING_DB=========CP');
    });
  });

  describe('parseGatewayErrorDetail', () => {
    it('parses nested error detail with callStack + sourceCode + exceptions', () => {
      const detail = parseGatewayErrorDetail(gatewayErrorDetailXml);
      expect(detail.type).toBe('Frontend Error');
      expect(detail.shortText).toBe('Division by zero');
      expect(detail.transactionId).toBe('GW_TX_42');
      expect(detail.username).toBe('JSMITH');
      expect(detail.serviceInfo.serviceName).toBe('ZBILLING_SRV');
      expect(detail.serviceInfo.namespace).toBe('sap');
      expect(detail.errorContext.errorInfo).toBe('DB error during read');
      expect(detail.errorContext.exceptions).toHaveLength(1);
      expect(detail.errorContext.exceptions[0].type).toBe('CX_SY_ZERODIVIDE');
      expect(detail.errorContext.exceptions[0].text.trim()).toBe(
        'Division by zero in billing report',
      );
      expect(String(detail.sourceCode.errorLine)).toBe('42');
      expect(detail.sourceCode.lines).toHaveLength(3);
      expect(detail.sourceCode.lines[1].isError).toBe(true);
      expect(detail.callStack).toHaveLength(2);
      expect(detail.callStack[0].program).toBe('ZCL_BILLING');
      expect(String(detail.callStack[0].line)).toBe('42');
    });

    it('handles missing sections gracefully', () => {
      const minimal = `<errorEntry type="Backend Error"><shortText>X</shortText></errorEntry>`;
      const detail = parseGatewayErrorDetail(minimal);
      expect(detail.type).toBe('Backend Error');
      expect(detail.shortText).toBe('X');
      expect(detail.callStack).toEqual([]);
      expect(detail.sourceCode.lines).toEqual([]);
      expect(detail.errorContext.exceptions).toEqual([]);
    });
  });
});
