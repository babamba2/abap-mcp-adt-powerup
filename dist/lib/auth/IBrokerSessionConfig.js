"use strict";
/**
 * Configuration for creating an AuthBroker from a ready session
 *
 * This interface allows creating a broker without knowing WHERE the config came from
 * (.env file, service key, HTTP headers, etc.)
 *
 * Factory decides what stores/providers to create based on authType and available data:
 * - basic auth: only sessionStore (credentials are static)
 * - jwt auth: sessionStore + tokenProvider (for token refresh)
 * - jwt auth + serviceKeyPath: serviceKeyStore + sessionStore + tokenProvider
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IBrokerSessionConfig.js.map