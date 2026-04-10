"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveServiceBindingAcceptHeader = resolveServiceBindingAcceptHeader;
exports.parseServiceBindingPayload = parseServiceBindingPayload;
const fast_xml_parser_1 = require("fast-xml-parser");
function resolveServiceBindingAcceptHeader(format) {
    if (format === 'json') {
        return 'application/json';
    }
    if (format === 'plain') {
        return 'text/plain';
    }
    return 'application/vnd.sap.adt.businessservices.servicebinding.v2+xml';
}
function parseServiceBindingPayload(payload, format) {
    if (format === 'plain') {
        return payload;
    }
    if (format === 'json') {
        if (typeof payload === 'string') {
            try {
                return JSON.parse(payload);
            }
            catch {
                return payload;
            }
        }
        return payload;
    }
    if (typeof payload !== 'string') {
        return payload;
    }
    const trimmed = payload.trim();
    if (!trimmed.startsWith('<')) {
        return payload;
    }
    try {
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        return parser.parse(trimmed);
    }
    catch {
        return payload;
    }
}
//# sourceMappingURL=serviceBindingPayloadUtils.js.map