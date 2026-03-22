"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/app/providers";
import { TruthMarketContract } from "@/lib/genlayer/contract";
import type { MarketInfo, MarketOdds } from "@/lib/genlayer/client";
import { toast } from "sonner";

const QUICK_AMOUNTS = [10, 50, 100, 500];

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function TradePanel({
  market,
  odds,
  contractAddress,
  onTrade,
}: {
  market: MarketInfo;
  odds: MarketOdds;
  contractAddress: string;
  onTrade: () => void;
}) {
  const { address, connect } = useWallet();
  const [selectedSide, setSelectedSide] = useState<string>(market.side_a);
  const [amount, setAmount] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const numericAmount = parseFloat(amount) || 0;

  // Calculate potential payout using basis points (10000 bps = 1x)
  // side_a_payout_bps: e.g. 15625 bps = 1.5625x
  const payoutMultiplier =
    selectedSide === market.side_a
      ? odds.side_a_payout_bps / 10000
      : odds.side_b_payout_bps / 10000;

  const potentialPayout =
    numericAmount > 0 ? (numericAmount * payoutMultiplier).toFixed(2) : null;

  const potentialProfit =
    numericAmount > 0
      ? (numericAmount * payoutMultiplier - numericAmount).toFixed(2)
      : null;

  const handlePlaceBet = async () => {
    if (!address || !amount) return;
    setIsPlacing(true);
    try {
      const contract = new TruthMarketContract(contractAddress, address);
      const weiAmount = BigInt(Math.floor(parseFloat(amount) * 1e18));
      await contract.placeBet(selectedSide, weiAmount);
      toast.success(`Bet placed: ${amount} GEN on "${selectedSide}"`);
      setAmount("");
      onTrade();
    } catch (err) {
      toast.error(`Failed to place bet: ${(err as Error).message}`);
    } finally {
      setIsPlacing(false);
    }
  };

  const handleResolve = async () => {
    if (!address) return;
    setIsResolving(true);
    toast.info("Triggering AI resolution. Validators are fetching data...");
    try {
      const contract = new TruthMarketContract(contractAddress, address);
      await contract.resolve();
      toast.success("Market resolved by AI consensus!");
      onTrade();
    } catch (err) {
      toast.error(`Resolution failed: ${(err as Error).message}`);
    } finally {
      setIsResolving(false);
    }
  };

  if (market.is_resolved) {
    return (
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Resolution
        </h3>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              AI Consensus
            </Badge>
          </div>
          <p className="text-lg font-semibold">Winner: {market.winning_side}</p>
          <p className="text-sm text-muted-foreground">
            {market.resolution_reasoning}
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            Resolved at: {market.resolved_at}
          </p>
        </div>

        {address && (
          <Button
            className="w-full"
            onClick={async () => {
              try {
                const contract = new TruthMarketContract(
                  contractAddress,
                  address
                );
                if (market.winning_side === "UNDETERMINED") {
                  await contract.claimRefund();
                  toast.success("Refund claimed!");
                } else {
                  await contract.claim();
                  toast.success("Winnings claimed!");
                }
                onTrade();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            {market.winning_side === "UNDETERMINED"
              ? "Claim Refund"
              : "Claim Winnings"}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-5">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Place Your Bet
      </h3>

      {/* Side selection with payout info */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelectedSide(market.side_a)}
          className={`rounded-lg border p-3 text-left transition-all ${
            selectedSide === market.side_a
              ? "border-emerald-500 bg-emerald-500/10 opacity-100"
              : "border-border hover:border-border/80 opacity-50"
          }`}
        >
          <p className="text-sm font-semibold">{market.side_a}</p>
          <p className="mt-1 text-lg font-mono font-bold tabular-nums text-emerald-400">
            {odds.side_a_pct}%
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {(odds.side_a_payout_bps / 10000).toFixed(2)}x payout
          </p>
        </button>

        <button
          onClick={() => setSelectedSide(market.side_b)}
          className={`rounded-lg border p-3 text-left transition-all ${
            selectedSide === market.side_b
              ? "border-red-500 bg-red-500/10 opacity-100"
              : "border-border hover:border-border/80 opacity-50"
          }`}
        >
          <p className="text-sm font-semibold">{market.side_b}</p>
          <p className="mt-1 text-lg font-mono font-bold tabular-nums text-red-400">
            {odds.side_b_pct}%
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {(odds.side_b_payout_bps / 10000).toFixed(2)}x payout
          </p>
        </button>
      </div>

      {/* Amount input with quick buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="amount" className="text-xs text-muted-foreground">
            Amount (GEN)
          </Label>
          {/* Quick amount buttons */}
          <div className="flex items-center gap-1">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
            GEN
          </span>
        </div>
      </div>

      {/* Potential payout preview */}
      {potentialPayout !== null && numericAmount > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Payout preview
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bet</span>
            <span className="font-mono font-medium">{numericAmount} GEN</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Multiplier</span>
            <span className="font-mono font-medium">
              {payoutMultiplier.toFixed(2)}x
            </span>
          </div>
          <div className="h-px bg-border/60 my-1" />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>If you win</span>
            <span className="font-mono text-emerald-400">
              +{potentialPayout} GEN
            </span>
          </div>
          {potentialProfit !== null && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Profit</span>
              <span className="font-mono text-emerald-400">
                +{potentialProfit} GEN
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {address ? (
        <div className="space-y-2">
          <Button
            className="w-full gap-2"
            disabled={!amount || isPlacing || numericAmount <= 0}
            onClick={handlePlaceBet}
          >
            {isPlacing ? (
              <>
                <LoadingSpinner />
                Placing bet...
              </>
            ) : (
              `Bet ${amount || "0"} GEN on "${selectedSide}"`
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={isResolving}
            onClick={handleResolve}
          >
            {isResolving ? (
              <>
                <LoadingSpinner />
                AI Validators resolving...
              </>
            ) : (
              "Trigger AI Resolution"
            )}
          </Button>
        </div>
      ) : (
        <Button className="w-full" onClick={connect}>
          Connect Wallet to Trade
        </Button>
      )}

      {/* How it works */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          How AI Resolution Works
        </p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Multiple AI validators fetch data from resolution sources</li>
          <li>Each validator runs a different LLM (GPT, Claude, Llama)</li>
          <li>Validators independently evaluate the outcome</li>
          <li>Consensus reached through Equivalence Principle</li>
          <li>Funds auto-distribute to winners</li>
        </ol>
      </div>
    </Card>
  );
}
