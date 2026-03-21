const GENLAYER_CHAIN_ID_HEX = "0xf1c7"; // 61999
const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: "GenLayer Bradbury Testnet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: [],
};

export function isMetaMaskInstalled(): boolean {
  return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
}

function getProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not installed");
  }
  return window.ethereum;
}

export async function connectMetaMask(): Promise<string> {
  const provider = getProvider();
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  // Switch to GenLayer network
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });
  } catch (error: unknown) {
    const switchError = error as { code?: number };
    if (switchError.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [GENLAYER_NETWORK],
      });
    }
  }

  return accounts[0];
}

export async function getConnectedAccount(): Promise<string | null> {
  if (!isMetaMaskInstalled()) return null;
  try {
    const provider = getProvider();
    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];
    return accounts[0] || null;
  } catch {
    return null;
  }
}
