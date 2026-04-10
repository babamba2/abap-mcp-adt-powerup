"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRuntimePayloadToJson = parseRuntimePayloadToJson;
const fast_xml_parser_1 = require("fast-xml-parser");
const runtimeXmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
});
/**
 * Convert ADT XML payload to JSON object when payload is XML text.
 * If payload is not XML text, returns it as-is.
 */
function parseRuntimePayloadToJson(payload) {
    if (typeof payload !== 'string') {
        return payload;
    }
    const trimmed = payload.trim();
    if (!trimmed.startsWith('<')) {
        return payload;
    }
    try {
        return runtimeXmlParser.parse(trimmed);
    }
    catch {
        return payload;
    }
}
//# sourceMappingURL=runtimePayloadParser.js.map