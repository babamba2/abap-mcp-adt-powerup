"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchHandlersGroup = void 0;
const handleGetObjectsByType_1 = require("../../../handlers/search/readonly/handleGetObjectsByType");
const handleGetObjectsList_1 = require("../../../handlers/search/readonly/handleGetObjectsList");
// Import search handlers
// Import TOOL_DEFINITION from handlers
const handleSearchObject_1 = require("../../../handlers/search/readonly/handleSearchObject");
const BaseHandlerGroup_js_1 = require("../base/BaseHandlerGroup.js");
/**
 * Handler group for all search-related handlers
 * Contains handlers for searching and listing objects in the ABAP system
 */
class SearchHandlersGroup extends BaseHandlerGroup_js_1.BaseHandlerGroup {
    groupName = 'SearchHandlers';
    /**
     * Gets all search handler entries
     */
    getHandlers() {
        return [
            {
                toolDefinition: handleSearchObject_1.TOOL_DEFINITION,
                handler: (args) => (0, handleSearchObject_1.handleSearchObject)(this.context, args),
            },
            // Dynamic import handlers
            {
                toolDefinition: handleGetObjectsList_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetObjectsList_1.handleGetObjectsList)(this.context, args);
                },
            },
            {
                toolDefinition: handleGetObjectsByType_1.TOOL_DEFINITION,
                handler: (args) => {
                    return (0, handleGetObjectsByType_1.handleGetObjectsByType)(this.context, args);
                },
            },
        ];
    }
}
exports.SearchHandlersGroup = SearchHandlersGroup;
//# sourceMappingURL=SearchHandlersGroup.js.map