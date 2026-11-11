/**
 * ADT connection transport from the profile env.
 *
 *   SAP_CONNECTION_TYPE unset / http → HTTP(S) (default)
 *   SAP_CONNECTION_TYPE=nco           → ADT over RFC (SADT_REST_RFC_ENDPOINT)
 *                                       through SAP .NET Connector (Windows)
 *
 * 'nco' maps to the connection library's RFC connection (connectionType
 * 'rfc' in ISapConfig), whose driver is NCo since
 * @babamba2/mcp-abap-connection 1.6.0. SAP_CONNECTION_TYPE=rfc (node-rfc)
 * itself was removed in 4.10.0 and is refused by ./removedTransports.
 */
export function rfcConnectionTypeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): 'rfc' | undefined {
  return (env.SAP_CONNECTION_TYPE ?? '').trim().toLowerCase() === 'nco'
    ? 'rfc'
    : undefined;
}
