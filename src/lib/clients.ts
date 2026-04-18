import { AdtClient, AdtClientLegacy } from '@babamba2/mcp-abap-adt-clients';
import type {
  IAbapConnection,
  ILogger,
} from '@babamba2/mcp-abap-adt-interfaces';
import type { AbapConnection } from '@babamba2/mcp-abap-connection';
import { registerConnectionResetHook } from './connectionEvents';
import { getSystemContext } from './systemContext';
import { getManagedConnection } from './utils';

let adtClient: AdtClient | undefined;
let adtClientConnection: AbapConnection | undefined;

export function createAdtClient(
  connection: IAbapConnection,
  logger?: ILogger,
): AdtClient {
  const ctx = getSystemContext();
  const options =
    ctx.masterSystem || ctx.responsible
      ? { masterSystem: ctx.masterSystem, responsible: ctx.responsible }
      : undefined;
  if (ctx.isLegacy) {
    return new AdtClientLegacy(connection, logger, options);
  }
  return new AdtClient(connection, logger, options);
}

export function getAdtClient(): AdtClient {
  const connection = getManagedConnection();

  if (!adtClient || adtClientConnection !== connection) {
    adtClient = createAdtClient(connection);
    adtClientConnection = connection;
  }

  return adtClient;
}

export function resetClientCache() {
  adtClient = undefined;
  adtClientConnection = undefined;
}

registerConnectionResetHook(resetClientCache);
