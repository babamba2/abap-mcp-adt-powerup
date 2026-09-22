"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeXmlEntities = decodeXmlEntities;
/**
 * Decode the XML entities ADT puts into attribute values and text nodes
 * (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, numeric references).
 * `&amp;` is decoded last so `&amp;lt;` stays the literal text `&lt;`.
 */
function decodeXmlEntities(text) {
    if (!text.includes('&'))
        return text;
    return text
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}
//# sourceMappingURL=xmlEntities.js.map