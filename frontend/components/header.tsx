"use client";

import { useWallet } from "@/app/providers";
import { Button } from "@/components/ui/button";

export function Header() {
  const { address, isConnecting, connect, disconnect, shortAddress } =
    useWallet();

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm">
            TM
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              TruthMarket
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              AI-Verified Prediction Markets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Bradbury Testnet
          </span>

          {address ? (
            <div className="flex items-center gap-2">
              <code className="rounded-md border bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
                {shortAddress}
              </code>
              <Button variant="ghost" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={connect} disabled={isConnecting} size="sm">
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
