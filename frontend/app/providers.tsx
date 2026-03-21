"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { connectMetaMask, getConnectedAccount } from "@/lib/genlayer/wallet";

type WalletContextType = {
  address: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  shortAddress: string;
};

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  shortAddress: "",
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    getConnectedAccount().then(setAddress);

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: unknown) => {
        const accs = accounts as string[];
        setAddress(accs[0] || null);
      };
      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener?.(
          "accountsChanged",
          handleAccountsChanged
        );
      };
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const account = await connectMetaMask();
      setAddress(account);
    } catch (err) {
      console.error("Failed to connect:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <WalletContext value={{ address, isConnecting, connect, disconnect, shortAddress }}>
      {children}
    </WalletContext>
  );
}
