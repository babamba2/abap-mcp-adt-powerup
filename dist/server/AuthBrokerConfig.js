"use strict";
/**
 * V2 Server configuration adapter for AuthBrokerFactory
 * Maps v2 ServerConfig to IAuthBrokerFactoryConfig
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthBrokerConfig = void 0;
class AuthBrokerConfig {
    defaultMcpDestination;
    defaultDestination;
    envFilePath;
    authBrokerPath;
    unsafe;
    transportType;
    useAuthBroker;
    browserAuthPort;
    browser;
    logger;
    constructor(serverConfig, logger) {
        this.defaultMcpDestination = serverConfig.mcpDestination;
        this.defaultDestination = serverConfig.mcpDestination;
        this.envFilePath = serverConfig.envFile || serverConfig.envFilePath;
        this.authBrokerPath = serverConfig.authBrokerPath;
        this.unsafe = serverConfig.unsafe ?? false;
        this.transportType = serverConfig.transport || 'stdio';
        this.useAuthBroker = serverConfig.useAuthBroker;
        this.browser = serverConfig.browser;
        if (serverConfig.browserAuthPort) {
            this.browserAuthPort = serverConfig.browserAuthPort;
        }
        else {
            // Use random port from high range (30000-39999) to avoid conflicts
            // with other services and parallel MCP instances
            this.browserAuthPort = 30000 + Math.floor(Math.random() * 10000);
        }
        this.logger = logger;
    }
    static fromServerConfig(config, logger) {
        return new AuthBrokerConfig(config, logger);
    }
}
exports.AuthBrokerConfig = AuthBrokerConfig;
//# sourceMappingURL=AuthBrokerConfig.js.map