"use strict";
/**
 * Handler groups exports
 *
 * Handler groups allow splitting handlers into logical groups for flexible composition.
 * Each group can be injected independently, allowing different server configurations
 * to use different sets of handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemHandlersGroup = exports.SearchHandlersGroup = exports.ReadOnlyHandlersGroup = exports.LowLevelHandlersGroup = exports.HighLevelHandlersGroup = exports.CompactHandlersGroup = void 0;
var CompactHandlersGroup_js_1 = require("./CompactHandlersGroup.js");
Object.defineProperty(exports, "CompactHandlersGroup", { enumerable: true, get: function () { return CompactHandlersGroup_js_1.CompactHandlersGroup; } });
var HighLevelHandlersGroup_js_1 = require("./HighLevelHandlersGroup.js");
Object.defineProperty(exports, "HighLevelHandlersGroup", { enumerable: true, get: function () { return HighLevelHandlersGroup_js_1.HighLevelHandlersGroup; } });
var LowLevelHandlersGroup_js_1 = require("./LowLevelHandlersGroup.js");
Object.defineProperty(exports, "LowLevelHandlersGroup", { enumerable: true, get: function () { return LowLevelHandlersGroup_js_1.LowLevelHandlersGroup; } });
var ReadOnlyHandlersGroup_js_1 = require("./ReadOnlyHandlersGroup.js");
Object.defineProperty(exports, "ReadOnlyHandlersGroup", { enumerable: true, get: function () { return ReadOnlyHandlersGroup_js_1.ReadOnlyHandlersGroup; } });
var SearchHandlersGroup_js_1 = require("./SearchHandlersGroup.js");
Object.defineProperty(exports, "SearchHandlersGroup", { enumerable: true, get: function () { return SearchHandlersGroup_js_1.SearchHandlersGroup; } });
var SystemHandlersGroup_js_1 = require("./SystemHandlersGroup.js");
Object.defineProperty(exports, "SystemHandlersGroup", { enumerable: true, get: function () { return SystemHandlersGroup_js_1.SystemHandlersGroup; } });
//# sourceMappingURL=index.js.map