import dotenv from 'dotenv';

dotenv.config();

interface Config {
  // GenLayer -> EVM direction
  bridgeSenderAddress?: string;
  bridgeForwarderAddress?: string;
  campaignFactoryAddress?: string;
  forwarderNetworkRpcUrl?: string;
  genlayerRpcUrl?: string;
  privateKey?: string;
  bridgeSyncInterval?: string;
  // EVM -> GenLayer direction
  baseSepoliaRpcUrl?: string;
  betFactoryAddress?: string;
  // HTTP API
  httpPort?: string;
}

function loadConfig(): Config {
  const {
    BRIDGE_FORWARDER_ADDRESS,
    BRIDGE_SENDER_ADDRESS,
    FORWARDER_NETWORK_RPC_URL,
    GENLAYER_RPC_URL,
    PRIVATE_KEY,
    BRIDGE_SYNC_INTERVAL = '*/5 * * * *', // Default to every 5 minutes
    // EVM -> GenLayer
    BASE_SEPOLIA_RPC_URL,
    BET_FACTORY_ADDRESS,
    // HTTP API
    HTTP_PORT = '3001', // Default port
  } = process.env;

  try {
    return {
      bridgeSenderAddress: BRIDGE_SENDER_ADDRESS,
      bridgeForwarderAddress: BRIDGE_FORWARDER_ADDRESS,
      forwarderNetworkRpcUrl: FORWARDER_NETWORK_RPC_URL,
      genlayerRpcUrl: GENLAYER_RPC_URL,
      privateKey: PRIVATE_KEY,
      bridgeSyncInterval: BRIDGE_SYNC_INTERVAL,
      // EVM -> GenLayer
      baseSepoliaRpcUrl: BASE_SEPOLIA_RPC_URL,
      betFactoryAddress: BET_FACTORY_ADDRESS,
      // HTTP API
      httpPort: HTTP_PORT,
    };
  } catch (error) {
    console.warn('Failed to load config:', error);
    return {};
  }
}

export function getRequiredConfig(key: keyof Config, envKey: string): string {
  const config = loadConfig();
  const value = config[key] || process.env[envKey];

  if (!value) {
    throw new Error(`Missing required configuration: ${key}`);
  }

  return value;
}

// Export specific getters for each required address
export function getBridgeSenderAddress(): string {
  return getRequiredConfig('bridgeSenderAddress', 'BRIDGE_SENDER_ADDRESS');
}

export function getBridgeForwarderAddress(): string {
  return getRequiredConfig('bridgeForwarderAddress', 'BRIDGE_FORWARDER_ADDRESS');
}

export function getForwarderNetworkRpcUrl(): string {
  return getRequiredConfig('forwarderNetworkRpcUrl', 'FORWARDER_NETWORK_RPC_URL');
}

export function getGenlayerRpcUrl(): string {
  return getRequiredConfig('genlayerRpcUrl', 'GENLAYER_RPC_URL');
}

export function getPrivateKey(): string {
  return getRequiredConfig('privateKey', 'PRIVATE_KEY');
}

export function getBridgeSyncInterval(): string {
  return getRequiredConfig('bridgeSyncInterval', 'BRIDGE_SYNC_INTERVAL');
}

// EVM -> GenLayer getters
export function getBaseSepoliaRpcUrl(): string {
  return getRequiredConfig('baseSepoliaRpcUrl', 'BASE_SEPOLIA_RPC_URL');
}

export function getBetFactoryAddress(): string {
  return getRequiredConfig('betFactoryAddress', 'BET_FACTORY_ADDRESS');
}

// HTTP API getter
export function getHttpPort(): number {
  const config = loadConfig();
  // Railway's PORT takes priority over config defaults
  const port = process.env.PORT || config.httpPort || process.env.HTTP_PORT || '3001';

  // Debug logging for Railway
  console.log(`[CONFIG] Port resolution: config.httpPort=${config.httpPort}, process.env.PORT=${process.env.PORT}, final port=${port}`);

  return parseInt(port, 10);
}

// Optional config getter (returns undefined instead of throwing)
export function getOptionalConfig(key: keyof Config, envKey: string): string | undefined {
  const config = loadConfig();
  return config[key] || process.env[envKey];
}
