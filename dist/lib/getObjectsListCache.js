"use strict";
// In-memory cache for GetObjectsList
Object.defineProperty(exports, "__esModule", { value: true });
exports.objectsListCache = void 0;
class ObjectsListCache {
    cache = null;
    setCache(data) {
        this.cache = data;
    }
    getCache() {
        return this.cache;
    }
    clearCache() {
        this.cache = null;
    }
}
exports.objectsListCache = new ObjectsListCache();
//# sourceMappingURL=getObjectsListCache.js.map