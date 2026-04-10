"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdtClient = createAdtClient;
exports.getAdtClient = getAdtClient;
exports.resetClientCache = resetClientCache;
const adt_clients_1 = require("@mcp-abap-adt/adt-clients");
const connectionEvents_1 = require("./connectionEvents");
const systemContext_1 = require("./systemContext");
const utils_1 = require("./utils");
let adtClient;
let adtClientConnection;
function createAdtClient(connection, logger) {
    const ctx = (0, systemContext_1.getSystemContext)();
    const options = ctx.masterSystem || ctx.responsible
        ? { masterSystem: ctx.masterSystem, responsible: ctx.responsible }
        : undefined;
    if (ctx.isLegacy) {
        return new adt_clients_1.AdtClientLegacy(connection, logger, options);
    }
    return new adt_clients_1.AdtClient(connection, logger, options);
}
function getAdtClient() {
    const connection = (0, utils_1.getManagedConnection)();
    if (!adtClient || adtClientConnection !== connection) {
        adtClient = createAdtClient(connection);
        adtClientConnection = connection;
    }
    return adtClient;
}
function resetClientCache() {
    adtClient = undefined;
    adtClientConnection = undefined;
}
(0, connectionEvents_1.registerConnectionResetHook)(resetClientCache);
//# sourceMappingURL=clients.js.map