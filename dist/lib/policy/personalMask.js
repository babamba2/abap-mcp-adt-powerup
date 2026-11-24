"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASK_VERSION = exports.CLEAR_DATATYPES = exports.CLEAR_DDIC = exports.PERSONAL_DDIC_PATTERNS = exports.PERSONAL_NAME_PATTERNS = exports.PERSONAL_DOMAIN = exports.PERSONAL_DTEL = exports.PERSONAL_EXACT = void 0;
exports.isPersonalField = isPersonalField;
exports.isClearField = isClearField;
exports.isRefusedTable = isRefusedTable;
exports.maskToken = maskToken;
exports.ddicFromTableData = ddicFromTableData;
exports.tablesInSql = tablesInSql;
exports.parseStrictSelect = parseStrictSelect;
exports.maskRows = maskRows;
exports.maskSpecFrom = maskSpecFrom;
/**
 * Personal-data masking for test-data reads (`mask` on GetTableContents / GetSqlQuery /
 * GetRemoteTableContents), so personal values never leave the server.
 *
 * Same personal-field lists, table refusals and strict SELECT grammar as the sc4sap
 * plugin's scripts/program-test/pt-lib.mjs (program-test skill); both repos assert the
 * shared vectors in `src/__tests__/unit/fixtures/mask-vectors.json` — change both
 * together. Tokens are made only here: HMAC under a server-side key (maskSecret.ts).
 *
 * Allow-list: a column keeps its value only when it maps (through the SELECT list,
 * alias → source field, or by its own name) to a field of the table's DDIC that is
 * clearly non-personal by DDIC semantics (isClearField: client, org keys, document
 * numbers, type / status codes, plain document dates, amounts, quantities, currency and
 * unit fields) AND matches none of the personal name / data element / domain shapes.
 * Everything else — unlisted data elements, expressions, unknown columns, fields the
 * DDIC does not list — is masked.
 */
const node_crypto_1 = require("node:crypto");
const up = (s) => String(s ?? '')
    .trim()
    .toUpperCase();
/** Field names holding personal data: names, address, contact, bank, tax / ID numbers, birth data, user IDs. */
exports.PERSONAL_EXACT = new Set([
    'NAME1',
    'NAME2',
    'NAME3',
    'NAME4',
    'NAME_CO',
    'NAMEV',
    'NAME_FIRST',
    'NAME_LAST',
    'NAME_LST2',
    'NAME_TEXT',
    'NAMEMIDDLE',
    'NAME_ORG1',
    'NAME_ORG2',
    'NAME_ORG3',
    'NAME_ORG4',
    'MC_NAME1',
    'MC_NAME2',
    'MCOD1',
    'MCOD2',
    'SORTL',
    'SORT1',
    'SORT2',
    'ENAME',
    'VORNA',
    'NACHN',
    'RUFNM',
    'STRAS',
    'STREET',
    'STR_SUPPL1',
    'STR_SUPPL2',
    'STR_SUPPL3',
    'HOUSE_NUM1',
    'HOUSE_NUM2',
    'PFACH',
    'PSTL2',
    'PO_BOX',
    'ORT01',
    'ORT02',
    'CITY1',
    'CITY2',
    'MC_STREET',
    'MC_CITY1',
    'TELF1',
    'TELF2',
    'TELFX',
    'TELTX',
    'TELX1',
    'TELBX',
    'TEL_NUMBER',
    'TEL_EXTENS',
    'FAX_NUMBER',
    'FAX_EXTENS',
    'MOB_NUMBER',
    'SMTP_ADDR',
    'E_MAIL',
    'EMAIL',
    'INTAD',
    'BANKN',
    'BKONT',
    'IBAN',
    'KOINH',
    'ACCNAME',
    'BKREF',
    'CCNUM',
    'CCINS_NUM',
    'STCD1',
    'STCD2',
    'STCD3',
    'STCD4',
    'STCD5',
    'STCEG',
    'STENR',
    'STKZN',
    'TAXNUM',
    'J_1KFREPRE',
    'J_1KFTBUS',
    'J_1KFTIND',
    'GBDAT',
    'GBORT',
    'BIRTHDT',
    'BIRTHPL',
    'PERID',
    'ICNUM',
    'IDNUMBER',
    'PASSPORT',
    'PERNR',
    'GESCH',
    'ERNAM',
    'AENAM',
    'UNAME',
    'USNAM',
    'BNAME',
    'CREATED_BY',
    'CHANGED_BY',
    'LAST_CHANGED_BY',
    'CRUSR',
    'CHUSR',
    'USERNAME',
    'NAME',
    'NAME_LAST2',
    'NAME1_TEXT',
    'NAMECOMBINED',
    'NAME_GRP1',
    'NAME_GRP2',
    'NICKNAME',
    'INITIALS',
    'SPNAM',
    'EMPLO',
    'MCOD3',
    'MC_NAMEFIR',
    'MC_NAMELAS',
    'BU_SORT1',
    'BU_SORT2',
    'SORT_PHN',
    'ANRED',
    'FORM',
    'PASSNAME',
    'PASSFORM',
    'PROFESSION',
    'CITY',
    'HOME_CITY',
    'POSTCODE',
    'POSTBOX',
    'PSTLZ',
    'POST_CODE1',
    'POST_CODE2',
    'POST_CODE3',
    'PO_BOX_LOC',
    'PO_BOX_LOBBY',
    'HOUSE_NUM3',
    'LOCATION',
    'BUILDING',
    'FLOOR',
    'ROOMNUMBER',
    'EXTENSION1',
    'EXTENSION2',
    'COUNTY',
    'TOWNSHIP',
    'MC_COUNTY',
    'MC_TOWNSHIP',
    'TELEPHONE',
    'PHONE',
    'MOBILE',
    'FAX',
    'TELNR_LONG',
    'TELNR_CALL',
    'SMTP_SRCH',
    'WEBUSER',
    'KNURL',
    'LFURL',
    'PASSBIRTH',
    'DEATHDT',
    'SEX',
    'SEXKZ',
    'GENDER',
    'XSEXM',
    'XSEXF',
    'XSEXU',
    'MARST',
    'FAMST',
    'NATIO',
    'PERNO',
    'STCD6',
    'XUBNAME',
]);
const DATE_FIELDS = new Set(['GBDAT', 'BIRTHDT']);
const BIRTH_DATE_NAME = /BIRTH|GBDAT|GEB|DOB|DEATHDT/;
/** Data elements of personal data. */
exports.PERSONAL_DTEL = new Set([
    'NAME1_GP',
    'NAME2_GP',
    'NAME3_GP',
    'NAME4_GP',
    'NAME1',
    'NAME2',
    'AD_NAME1',
    'AD_NAME2',
    'AD_NAME3',
    'AD_NAME4',
    'AD_NAMEFIR',
    'AD_NAMELAS',
    'AD_NAMEMID',
    'AD_NAME_CO',
    'AD_NAMTEXT',
    'BU_NAMEP_F',
    'BU_NAMEP_L',
    'BU_NAMEOR1',
    'BU_NAMEOR2',
    'BU_NAMEOR3',
    'BU_NAMEOR4',
    'BU_NAMEPL2',
    'BU_MCNAME1',
    'BU_MCNAME2',
    'NAMEV_VP',
    'NAME1_VP',
    'EMNAM',
    'PAD_VORNA',
    'PAD_NACHN',
    'VORNA',
    'NACHN',
    'STRAS_GP',
    'AD_STREET',
    'AD_STRSPP1',
    'AD_STRSPP2',
    'AD_STRSPP3',
    'AD_HSNM1',
    'AD_HSNM2',
    'ORT01_GP',
    'ORT02_GP',
    'AD_CITY1',
    'AD_CITY2',
    'PFACH',
    'AD_POBX',
    'AD_MC_STRT',
    'AD_MC_CITY',
    'TELF1',
    'TELF2',
    'TELFX',
    'TELTX',
    'TELX1',
    'TELBX',
    'AD_TLNMBR',
    'AD_TLNMBR1',
    'AD_TLXTNS',
    'AD_FXNMBR',
    'AD_FXNMBR1',
    'AD_FXXTNS',
    'AD_MBNMBR1',
    'AD_SMTPADR',
    'INTAD',
    'BANKN',
    'BKONT',
    'IBAN',
    'KOINH_FI',
    'BU_KOINH',
    'BKREF',
    'CCNUM',
    'CVVAL',
    'STCD1',
    'STCD2',
    'STCD3',
    'STCD4',
    'STCD5',
    'STCEG',
    'STENR',
    'BPTAXNUM',
    'BPTAXNUMXL',
    'GBDAT',
    'GBDAT_GP',
    'BU_BIRTHDT',
    'BU_BIRTHPL',
    'GBORT',
    'PERID',
    'ICNUM',
    'PRDNI',
    'PERNR_D',
    'P_PERNR',
    'PERSNO',
    'GESCH',
    'BU_SEXID',
    'ERNAM',
    'AENAM',
    'USNAM',
    'UNAME',
    'XUBNAME',
    'SYUNAME',
    'BNAME',
    'CRUSR',
    'CHUSR',
    'ABP_CREATION_USER',
    'ABP_LASTCHANGE_USER',
    'VDM_CREATEDBYUSERID',
    'VDM_LASTCHANGEDBYUSERID',
    'S_CUSTNAME',
    'S_FORM',
    'S_STREET',
    'S_POSTBOX',
    'S_PHONENO',
    'S_EMAIL',
    'S_WEBNAME',
    'S_PASSNAME',
    'S_BIRTHDAT',
    'POSTCODE',
    'CITY',
    'PSTLZ',
    'PSTL2',
    'NAMECOMBINED',
    'SPNAM',
    'ANRED',
    'ANRED_AP',
    'FAMST',
    'AD_NAMLAS2',
    'AD_INITS',
    'AD_SEX',
    'AD_PROFESS',
    'AD_POBXLOC',
    'AD_LCTN',
    'AD_BLDNG',
    'AD_FLOOR',
    'AD_ROOMNUM',
    'AD_EXTENS1',
    'AD_EXTENS2',
    'AD_COUNTY',
    'AD_TOWNSHIP',
    'AD_TELNRLG',
    'AD_TELNRCL',
    'BU_NAME1TX',
    'BU_NICKNAM',
    'BU_EMPLO',
    'BU_MARST',
    'BU_NATIO',
    'BU_PERNO',
    'BU_XUBNAME',
    'BU_XSEXM',
    'BU_XSEXF',
    'BU_XSEXU',
    'GBDAT_Q',
    'GBORT_Q',
    'SEXKZ',
    'STCD6',
    'ERNAM_RF',
    'AENAM_RF',
    'REPRES',
]);
/** Domains of personal data. */
exports.PERSONAL_DOMAIN = new Set([
    'AD_SMTPADR',
    'AD_TLNMBR',
    'AD_FXNMBR',
    'XUBNAME',
    'USNAM',
    'PERNR',
    'BANKN',
    'IBAN',
    'STCD1',
    'STCD2',
    'STCD3',
    'STCEG',
    'GBDAT',
    'BU_BIRTHDT',
    'TELF1',
    'AD_STREET',
    'AD_NAME',
    'NAME',
    'ORT01',
    'STRAS',
    'AD_SMTPAD2',
    'AD_TELNRLG',
    'AD_TELNRCL',
    'AD_NAMEFIR',
    'AD_NAMELAS',
    'BU_NAME',
    'S_CUSTNAME',
    'S_PHONENO',
    'S_EMAIL',
    'POSTCODE',
    'PSTLZ',
    'TELF2',
    'TELFX',
]);
/** Tables never read for test data: HR, user / credential, contact / bank detail, secure store. */
const REFUSED_TABLES = [
    /^PA\d{4}$/,
    /^PB\d{4}$/,
    /^HRP\d{4}$/,
    /^PCL\d$/,
    /^USR\d\d$/,
    /^USH\d\d$/,
    /^UST\d\d$/,
    /^AGR_/,
    /^RSECTAB$/,
    /^RSECSTORE/,
    /^SSF_PSE/,
    /^ADR[2-6]$/,
    /^ADRP$/,
    /^BUT0ID$/,
    /^KNBK$/,
    /^LFBK$/,
    /^BUT0BK$/,
    /^TIBAN$/,
    /^PCA_/,
];
/** Field-name shapes of personal data (names, phone / fax / mobile, e-mail, birth, street lines, bank and tax numbers). */
exports.PERSONAL_NAME_PATTERNS = [
    /^NAME(\d|_|$|V$|COMBINED|MIDDLE)/,
    /_NAME\d?$/,
    // custom fields (Z tables): CUSTNAME, FULLNAME, CONTACT_NAME, NAME_KR, …
    /NAME\d?$|_NAME|NAME_/,
    /CONTACT|ANSPR|SACHB|OWNER|RESP_?PERS|TITLE_LET|SALUT/,
    /HOMEPAGE|URL|URI$|IP_?ADDR/,
    /^MC_(NAME|STREET|CITY|COUNTY|TOWNSHIP)/,
    /TELEPHONE|PHONE|MOBILE/,
    /^(TEL|FAX|MOB)/,
    /SMTP|MAIL/,
    /BIRTH|GBDAT|GEB|DOB|DEATHDT/,
    /^(STREET|STRAS|STR_SUPPL|HOUSE_NUM|POST_CODE|PSTLZ|ORT0)/,
    /^CITY\d?$/,
    /IBAN|BANKN/,
    /^STCD\d$/,
];
/** Data element / domain shapes of personal data — checked on the source field's DDIC. */
exports.PERSONAL_DDIC_PATTERNS = [
    /^AD_NAME/,
    /^AD_MC_/,
    /^AD_(TLNMBR|TLXTNS|FXNMBR|FXXTNS|MBNMBR|TELNR|SMTPAD|STRSPP|HSNM|PSTCD|SORT|SRTPHN|CITY\d)/,
    /^BU_(NAME|MCNAME|BIRTH|DEATH|NICKNAM|SORT\d|XSEX)/,
    /^NAME\d/,
    /^NAMEV/,
    /^(TELF|TELX|TELBX|TELTX)/,
    /^(STRAS|ORT0\d|PSTLZ|PSTL2|PFACH)(_|$)/,
    /^MCD[DK]\d$/,
    /SMTP|E_?MAIL/,
    /PHONE|TELNR|FAXNR|MOBNR/,
    /BIRTH|GBDAT|GBORT|GEB|DOB/,
    /IBAN|BANKN|BKONT/,
    /^STCD\d/,
    // custom data elements (Z*): ZZ_CUSTNAME, Z_CONTACT_NAME, ZURL, …
    /NAME\d?$|_NAME|NAME_/,
    /CONTACT|ANSPR|SACHB|OWNER|RESP_?PERS|TITLE_LET|SALUT/,
    /HOMEPAGE|URL|URI$|IP_?ADDR/,
];
function isPersonalField(name, extra = [], ddic = null) {
    const n = up(name);
    if (exports.PERSONAL_EXACT.has(n) || extra.map(up).includes(n))
        return true;
    if (exports.PERSONAL_NAME_PATTERNS.some((re) => re.test(n)))
        return true;
    if (!ddic)
        return false;
    const r = up(ddic.rollname);
    const d = up(ddic.domname);
    return (exports.PERSONAL_DTEL.has(r) ||
        exports.PERSONAL_DOMAIN.has(d) ||
        exports.PERSONAL_DDIC_PATTERNS.some((re) => (r && re.test(r)) || (d && re.test(d))));
}
/**
 * Data elements / domains that are clearly non-personal: client, organisational keys,
 * country / region / language, business-partner and document numbers, type / status /
 * flag codes, plain document dates, amounts, quantities, currency and unit keys.
 * Anything not on this list is masked on a masked read.
 */
exports.CLEAR_DDIC = new Set([
    // client
    'MANDT',
    'S_MANDT',
    // organisational keys, country, region, language, zones
    'BUKRS',
    'WERKS',
    'WERKS_D',
    'WERKS_EXT',
    'VKORG',
    'VTWEG',
    'SPART',
    'VKBUR',
    'VKGRP',
    'EKORG',
    'EKGRP',
    'LGORT',
    'LGORT_D',
    'LGNUM',
    'KOKRS',
    'KOSTL',
    'PRCTR',
    'GSBER',
    'VSTEL',
    'BWKEY',
    'LAND1',
    'LAND1_GP',
    'S_COUNTRY',
    'AD_COMCTRY',
    'AD_POBXCTY',
    'AD_NATION',
    'REGIO',
    'S_REGION',
    'REGIOGROUP',
    'SPRAS',
    'LANGU',
    'BU_LANGU_CORR',
    'LZONE',
    'AD_TZONE',
    'TZNZONE',
    'TXJCD',
    'AD_TXJCD',
    // partner, address and document numbers / keys
    'KUNNR',
    'LIFNR',
    'BU_PARTNER',
    'PARNR',
    'ADRNR',
    'AD_ADDRNUM',
    'AD_PERSNUM',
    'AD_CONSNUM',
    'S_CUSTOMER',
    'MATNR',
    'CHARG_D',
    'VBELN',
    'VBELN_VA',
    'VBELN_VL',
    'VBELN_VF',
    'POSNR',
    'POSNR_VA',
    'POSNR_VL',
    'POSNR_VF',
    'EBELN',
    'EBELP',
    'BANFN',
    'BNFPO',
    'BELNR',
    'BELNR_D',
    'BUZEI',
    'GJAHR',
    'MBLNR',
    'MJAHR',
    'MBLPO',
    'AUFNR',
    'SAKNR',
    'HKONT',
    'S_CARR_ID',
    'S_CONN_ID',
    'S_BOOK_ID',
    'S_AGNCYNUM',
    'S_COUNTNUM',
    // type / status / flag codes
    'KTOKD',
    'KTOKK',
    'BU_GROUP',
    'BU_GRPTYP',
    'BU_LEGENTY',
    'BU_INDSECT',
    'BRSCH',
    'KUKLA',
    'KDGRP',
    'AUART',
    'BSART',
    'BLART',
    'BWART',
    'PSTYV',
    'S_CUSTTYPE',
    'S_CLASS',
    'S_CANCEL',
    'S_RESERV',
    'S_INVFLAG',
    'S_SMOKER',
    'AD_GROUP',
    'AD_COMM',
    'AD_FLGDFAD',
    'AD_FLGDFNR',
    'AD_FLNOUSE',
    'AD_FLGHOME',
    'LOEVM_X',
    'SPERB_X',
    'SPERM_X',
    'AUFSD_X',
    'LIFSD_X',
    'FAKSD_X',
    'CASSD_X',
    'NODEL_X',
    'XCPDK',
    'BU_XBLCK',
    'BU_XDELE',
    'BU_XPCPT',
    'AD_XPCPT',
    'XFELD',
    'DATA_TEMPERATURE',
    // plain document dates and times
    'ERDAT',
    'ERDAT_RF',
    'AEDAT',
    'UPDAT_RF',
    'UPTIM_RF',
    'BUDAT',
    'BLDAT',
    'CPUDT',
    'CPUTM',
    'AUDAT',
    'BEDAT',
    'EINDT',
    'S_BDATE',
    'AD_DATE_FR',
    'AD_DATE_TO',
    'AD_VALFROM',
    'AD_VALTO',
    'BU_BP_VALID_FROM',
    'BU_BP_VALID_TO',
    // amounts, quantities, currency and unit keys
    'WAERS',
    'WAERK',
    'S_CURR',
    'S_CURRCODE',
    'S_F_CUR_PR',
    'S_L_CUR_PR',
    'S_DISCOUNT',
    'NETWR',
    'NETWR_AP',
    'NETPR',
    'DMBTR',
    'WRBTR',
    'KBETR',
    'MENGE_D',
    'BSTMG',
    'KWMENG',
    'LFIMG',
    'FKIMG',
    'MEINS',
    'VRKME',
    'BSTME',
    'S_LUGWEIGH',
    'S_WEIUNIT',
    'BRGEW',
    'NTGEW',
    'GEWEI',
]);
/** DDIC data types that are never personal on their own: amounts, quantities, currency and unit keys. */
exports.CLEAR_DATATYPES = new Set([
    'CURR',
    'QUAN',
    'CUKY',
    'UNIT',
]);
/**
 * Keep this field in clear on a masked read? Only with its DDIC, only when the data
 * element, domain or data type is on the clear list, and only when no personal shape
 * (name, data element, domain, extra field) matches.
 */
function isClearField(name, extra = [], ddic = null) {
    if (!ddic)
        return false;
    if (isPersonalField(name, extra, ddic))
        return false;
    return (exports.CLEAR_DDIC.has(up(ddic.rollname)) ||
        exports.CLEAR_DDIC.has(up(ddic.domname)) ||
        exports.CLEAR_DATATYPES.has(up(ddic.datatype)));
}
function isRefusedTable(name) {
    const t = up(name);
    return REFUSED_TABLES.some((re) => re.test(t));
}
/** Version of the token scheme and rule set, returned in `masking.version`. v2 = allow-list classifier (only clearly non-personal DDIC stays clear); v1 servers kept unlisted fields clear and are not accepted by the plugin. */
exports.MASK_VERSION = 'hmac-v2';
/**
 * Deterministic stand-in: HMAC-SHA256 under the server-side key (maskSecret.ts) of
 * run salt | table | field | value — same input in one run → same token, unrecoverable
 * without the key. Length ≤ original, digits stay digits, birth dates become 19000101.
 */
function maskToken(value, table, field, salt, secret) {
    const s = String(value ?? '');
    if (!s.trim())
        return s;
    const f = up(field);
    if (DATE_FIELDS.has(f))
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? '1900-01-01' : '19000101';
    // other birth / death dates: a date-shaped value becomes the fixed date too
    if (BIRTH_DATE_NAME.test(f) && /^(\d{8}|\d{4}-\d{2}-\d{2})$/.test(s.trim()))
        return s.includes('-') ? '1900-01-01' : '19000101';
    const h = (0, node_crypto_1.createHmac)('sha256', secret)
        .update(`${salt}|${up(table)}|${f}|${s.trim()}`)
        .digest('hex');
    if (/^\d+$/.test(s))
        return [...s]
            .map((_, i) => String(Number.parseInt(h[i % h.length], 16) % 10))
            .join('');
    const len = Math.min(s.length, 12);
    return `M${h.toUpperCase()}`.slice(0, len);
}
/** Field → data element / domain from a GetTable answer: ECC bridge JSON (DD03L rows) or the S/4 table source. */
function ddicFromTableData(body) {
    const fields = {};
    let asJson = null;
    try {
        asJson = JSON.parse(body);
    }
    catch {
        asJson = null;
    }
    if (asJson && typeof asJson === 'object') {
        const walk = (o, depth = 0) => {
            if (!o || typeof o !== 'object' || depth > 5)
                return;
            if (Array.isArray(o)) {
                for (const x of o)
                    walk(x, depth + 1);
                return;
            }
            const k = Object.fromEntries(Object.entries(o).map(([a, b]) => [
                a.toLowerCase(),
                b,
            ]));
            if (typeof k.fieldname === 'string' &&
                k.fieldname &&
                !k.fieldname.startsWith('.')) {
                fields[up(k.fieldname)] = {
                    rollname: up(k.rollname || k.data_element || ''),
                    domname: up(k.domname || k.domain || ''),
                    datatype: up(k.datatype || k.data_type || ''),
                };
            }
            for (const v of Object.values(o))
                if (v && typeof v === 'object')
                    walk(v, depth + 1);
        };
        walk(asJson);
    }
    else {
        for (const line of String(body).replace(/\r/g, '').split('\n')) {
            const m = line.match(/^\s*(?:key\s+)?([a-z0-9_/]+)\s*:\s*([a-z0-9_/]+)(?:\.([a-z0-9_]+))?/i);
            if (m && !/^(include|annotation|@)/i.test(m[1]))
                fields[up(m[1])] = /^abap$/i.test(m[2])
                    ? { rollname: '', domname: '', datatype: up(m[3]) }
                    : { rollname: up(m[2]), domname: '' };
        }
    }
    return Object.keys(fields).length ? fields : null;
}
/** Every table name after FROM / JOIN (also in sub-queries) — for the refusal check. */
function tablesInSql(sql) {
    return [...String(sql || '').matchAll(/\b(?:FROM|JOIN)\s+([\w/]+)/gi)].map((m) => up(m[1]));
}
const SQL_DENY_WORDS = /\b(?:UNION|INTERSECT|EXCEPT|WITH|JOIN|INNER|OUTER|LEFT|RIGHT|CROSS|EXISTS|GROUP|HAVING|CASE|CAST|COALESCE|OFFSET|CLIENT|USING|BYPASSING|APPENDING|INTO|FOR|PACKAGE|CONNECTION|ALL|ANY|SOME)\b/i;
const COND_WORDS = new Set([
    'AND',
    'OR',
    'NOT',
    'IN',
    'BETWEEN',
    'LIKE',
    'IS',
    'NULL',
    'INITIAL',
    'ESCAPE',
    'EQ',
    'NE',
    'LT',
    'GT',
    'LE',
    'GE',
]);
const COND_TOKEN = /'L'|-?\d+(?:\.\d+)?|<>|<=|>=|=|<|>|\(|\)|,|[\w/]+(?:~[\w/]+)?|\s+/y;
function simpleCondition(cond) {
    const toks = [];
    let pos = 0;
    while (pos < cond.length) {
        COND_TOKEN.lastIndex = pos;
        const m = COND_TOKEN.exec(cond);
        if (!m || m.index !== pos)
            return false;
        pos += m[0].length;
        if (m[0].trim())
            toks.push(m[0]);
    }
    let depth = 0;
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === '(') {
            const prev = up(toks[i - 1] || '');
            if (i > 0 && !['IN', 'AND', 'OR', 'NOT', '('].includes(prev))
                return false;
            depth++;
        }
        else if (t === ')') {
            depth -= 1;
            if (depth < 0)
                return false;
        }
        else if (/^[A-Za-z_/]/.test(t) &&
            !COND_WORDS.has(up(t)) &&
            toks[i + 1] === '(')
            return false;
    }
    return depth === 0;
}
/**
 * Strict SELECT grammar (allow-list): one SELECT, one table, plain fields with optional
 * AS, unique output names, simple WHERE, UP TO n ROWS, ORDER BY. Anything else fails.
 */
function parseStrictSelect(sql) {
    const raw = String(sql || '');
    if (/^\s*\*/m.test(raw))
        return { ok: false, why: 'comment line' };
    let s = '';
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] !== "'") {
            s += raw[i];
            continue;
        }
        let j = i + 1;
        for (;;) {
            if (j >= raw.length)
                return { ok: false, why: 'unterminated literal' };
            if (raw[j] === "'" && raw[j + 1] === "'") {
                j += 2;
                continue;
            }
            if (raw[j] === "'")
                break;
            j++;
        }
        s += "'L'";
        i = j;
    }
    if (/["`;@|{}#\\]|--|\/\*|\*\//.test(s))
        return {
            ok: false,
            why: 'comment, host variable, template or statement separator',
        };
    s = s.replace(/\s+/g, ' ').trim();
    if ((s.match(/\bSELECT\b/gi) || []).length !== 1 ||
        (s.match(/\bFROM\b/gi) || []).length !== 1)
        return { ok: false, why: 'more than one SELECT / FROM' };
    const deny = s.match(SQL_DENY_WORDS);
    if (deny)
        return {
            ok: false,
            why: `not in the strict grammar: ${deny[0].toUpperCase()}`,
        };
    const m = s.match(/^SELECT (?:SINGLE )?(?:DISTINCT )?(.+?) FROM ([\w/]+)(?: (?:AS )?(?!WHERE\b|UP\b|ORDER\b)(\w+))?(?: WHERE (.+?))?(?: UP TO \d+ ROWS)?(?: ORDER BY [\w~/]+(?: ?, ?[\w~/]+)*(?: (?:ASCENDING|DESCENDING|ASC|DESC))?)?$/i);
    if (!m)
        return { ok: false, why: 'statement shape outside the strict grammar' };
    if (m[4] && !simpleCondition(m[4]))
        return { ok: false, why: 'WHERE outside the strict grammar' };
    const columns = new Map();
    let star = false;
    const toks = m[1].split(/\s*,\s*|\s+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === '*' || /^\w+~\*$/.test(t)) {
            star = true;
            continue;
        }
        const f = t.match(/^(?:[\w/]+~)?([\w/]+)$/);
        if (!f || /^AS$/i.test(t))
            return { ok: false, why: `select list item ${t} is not a plain field` };
        let out = up(f[1]);
        if (/^AS$/i.test(toks[i + 1] || '')) {
            const alias = toks[i + 2];
            if (!alias || !/^[\w/]+$/.test(alias))
                return { ok: false, why: 'AS without an alias' };
            out = up(alias);
            i += 2;
        }
        if (columns.has(out))
            return { ok: false, why: `output name ${out} repeats` };
        columns.set(out, up(f[1]));
    }
    if (!columns.size && !star)
        return { ok: false, why: 'empty select list' };
    if (star && columns.size)
        return { ok: false, why: '* together with named columns' };
    return { ok: true, table: up(m[2]), columns, star };
}
/** Mask rows default-deny. */
function maskRows(rows, salt, extra, opts) {
    const masked = new Set();
    // output column → source field (null: not a field of the table → personal)
    const source = (col) => {
        const C = up(col);
        if (opts.columns)
            return opts.columns.has(C)
                ? (opts.columns.get(C) ?? null)
                : opts.star
                    ? C
                    : null;
        return C;
    };
    const personal = (col) => {
        const src = source(col);
        if (!src)
            return true;
        const dd = opts.ddic[src];
        if (!dd)
            return true;
        return !isClearField(src, extra, dd) || isPersonalField(col, extra);
    };
    const out = rows.map((r) => {
        const o = {};
        for (const [k, v] of Object.entries(r || {})) {
            if (personal(k) && String(v ?? '').trim()) {
                masked.add(up(k));
                // the source field, so an alias does not change the token
                o[k] = maskToken(v, opts.table, source(k) ?? k, salt, opts.secret);
            }
            else
                o[k] = v;
        }
        return o;
    });
    return { rows: out, masked: [...masked].sort() };
}
/** The `mask` argument, checked; a string says what is wrong; null when absent. */
function maskSpecFrom(raw) {
    if (raw === undefined || raw === null)
        return null;
    if (typeof raw !== 'object' || Array.isArray(raw))
        return 'mask must be an object { salt, extra_fields? }';
    const { salt, extra_fields: extra } = raw;
    if (typeof salt !== 'string' || !/^[0-9a-f]{16,64}$/i.test(salt))
        return 'mask.salt must be 16–64 hex characters';
    if (extra !== undefined &&
        (!Array.isArray(extra) ||
            extra.some((f) => typeof f !== 'string' || !/^[\w/]{1,30}$/.test(f))))
        return 'mask.extra_fields must be a list of field names';
    return { salt, extraFields: (extra ?? []).map(up) };
}
//# sourceMappingURL=personalMask.js.map