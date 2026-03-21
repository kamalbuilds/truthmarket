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
          <p className="text-lg font-semibold">
            Winner: {market.winning_side}
          </p>
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

      {/* Side selection */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelectedSide(market.side_a)}
          className={`rounded-lg border p-3 text-left transition-all ${
            selectedSide === market.side_a
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-border hover:border-border/80"
          }`}
        >
          <p className="text-sm font-medium">{market.side_a}</p>
          <p className="mt-1 text-lg font-mono font-bold tabular-nums text-emerald-400">
            {Math.round(odds.side_a_probability * 100)}%
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {odds.side_a_payout_ratio.toFixed(2)}x payout
          </p>
        </button>

        <button
          onClick={() => setSelectedSide(market.side_b)}
          className={`rounded-lg border p-3 text-left transition-all ${
            selectedSide === market.side_b
              ? "border-red-500 bg-red-500/10"
              : "border-border hover:border-border/80"
          }`}
        >
          <p className="text-sm font-medium">{market.side_b}</p>
          <p className="mt-1 text-lg font-mono font-bold tabular-nums text-red-400">
            {Math.round(odds.side_b_probability * 100)}%
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {odds.side_b_payout_ratio.toFixed(2)}x payout
          </p>
        </button>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-xs text-muted-foreground">
          Amount (GEN)
        </Label>
        <Input
          id="amount"
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Action buttons */}
      {address ? (
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={!amount || isPlacing}
            onClick={handlePlaceBet}
          >
            {isPlacing
              ? "Placing bet..."
              : `Bet ${amount || "0"} GEN on "${selectedSide}"`}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            disabled={isResolving}
            onClick={handleResolve}
          >
            {isResolving
              ? "AI Validators resolving..."
              : "Trigger AI Resolution"}
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
