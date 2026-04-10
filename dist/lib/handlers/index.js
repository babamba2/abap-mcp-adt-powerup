"use strict";
/**
 * Handlers module exports
 *
 * This module provides:
 * - Interfaces for handler groups and registries
 * - Base classes for creating handler groups
 * - Composite registry that supports Dependency Injection of handler groups
 * - Concrete handler group implementations
 * - HandlerExporter for easy integration with external servers
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeHandlersRegistry = exports.HandlerExporter = exports.createDefaultHandlerExporter = exports.BaseHandlerGroup = void 0;
// Base classes
var BaseHandlerGroup_js_1 = require("./base/BaseHandlerGroup.js");
Object.defineProperty(exports, "BaseHandlerGroup", { enumerable: true, get: function () { return BaseHandlerGroup_js_1.BaseHandlerGroup; } });
// Handler groups
__exportStar(require("./groups/index.js"), exports);
// Handler exporter for external server integration
var HandlerExporter_js_1 = require("./HandlerExporter.js");
Object.defineProperty(exports, "createDefaultHandlerExporter", { enumerable: true, get: function () { return HandlerExporter_js_1.createDefaultHandlerExporter; } });
Object.defineProperty(exports, "HandlerExporter", { enumerable: true, get: function () { return HandlerExporter_js_1.HandlerExporter; } });
// Interfaces
__exportStar(require("./interfaces.js"), exports);
// Registry implementations
var CompositeHandlersRegistry_js_1 = require("./registry/CompositeHandlersRegistry.js");
Object.defineProperty(exports, "CompositeHandlersRegistry", { enumerable: true, get: function () { return CompositeHandlersRegistry_js_1.CompositeHandlersRegistry; } });
//# sourceMappingURL=index.js.map