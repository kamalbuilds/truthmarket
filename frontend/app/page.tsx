"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { MarketCard } from "@/components/market-card";
import { TradePanel } from "@/components/trade-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TruthMarketContract } from "@/lib/genlayer/contract";
import { CONTRACT_ADDRESS } from "@/lib/genlayer/client";
import type { MarketInfo, MarketOdds } from "@/lib/genlayer/client";

const DEMO_MARKETS: MarketInfo[] = [
  {
    title: "Will Bitcoin exceed $100,000 by March 31, 2026?",
    description:
      "Resolves based on BTC/USD price on CoinMarketCap at end of March 31, 2026 UTC.",
    resolution_criteria:
      "Check BTC price on CoinMarketCap. If price >= $100,000, side_a wins.",
    resolution_sources: "https://coinmarketcap.com/currencies/bitcoin/",
    side_a: "Yes, above $100K",
    side_b: "No, below $100K",
    creator: "0x0000000000000000000000000000000000000000",
    created_at: "2026-03-20",
    end_date: "2026-03-31",
    total_side_a: 15000,
    total_side_b: 8500,
    total_pool: 23500,
    probability_a: 0.6383,
    probability_b: 0.3617,
    is_resolved: false,
    is_cancelled: false,
    winning_side: "",
    resolution_reasoning: "",
    resolved_at: "",
  },
  {
    title: "Will Argentina pass the crypto regulatory framework in Q1 2026?",
    description:
      "Resolves YES if Argentina Congress passes the crypto bill before April 1, 2026.",
    resolution_criteria:
      "Check Argentine Congress website and Reuters for bill passage confirmation.",
    resolution_sources: "https://www.hcdn.gob.ar/,https://www.reuters.com/",
    side_a: "Yes, bill passes",
    side_b: "No, not passed",
    creator: "0x0000000000000000000000000000000000000000",
    created_at: "2026-03-20",
    end_date: "2026-04-01",
    total_side_a: 4200,
    total_side_b: 6800,
    total_pool: 11000,
    probability_a: 0.3818,
    probability_b: 0.6182,
    is_resolved: false,
    is_cancelled: false,
    winning_side: "",
    resolution_reasoning: "",
    resolved_at: "",
  },
  {
    title: "Will ETH flip BTC in market cap before 2027?",
    description:
      "Resolves YES if ETH market cap exceeds BTC at any point before Jan 1, 2027.",
    resolution_criteria:
      "Check CoinMarketCap for ETH and BTC market cap comparison.",
    resolution_sources:
      "https://coinmarketcap.com/currencies/ethereum/,https://coinmarketcap.com/currencies/bitcoin/",
    side_a: "Yes, ETH flips BTC",
    side_b: "No, BTC stays on top",
    creator: "0x0000000000000000000000000000000000000000",
    created_at: "2026-03-20",
    end_date: "2027-01-01",
    total_side_a: 2100,
    total_side_b: 18900,
    total_pool: 21000,
    probability_a: 0.1,
    probability_b: 0.9,
    is_resolved: false,
    is_cancelled: false,
    winning_side: "",
    resolution_reasoning: "",
    resolved_at: "",
  },
];

export default function Home() {
  const [market, setMarket] = useState<MarketInfo | null>(null);
  const [odds, setOdds] = useState<MarketOdds | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadMarket = useCallback(async () => {
    if (!CONTRACT_ADDRESS) return;
    try {
      const contract = new TruthMarketContract();
      const [info, marketOdds] = await Promise.all([
        contract.getMarketInfo(),
        contract.getOdds(),
      ]);
      setMarket(info);
      setOdds(marketOdds);
      setIsLive(true);
    } catch {
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    loadMarket();
    const interval = setInterval(loadMarket, 10000);
    return () => clearInterval(interval);
  }, [loadMarket]);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="max-w-2xl space-y-4">
            <Badge
              variant="secondary"
              className="bg-amber-500/10 text-amber-400 border-amber-500/20"
            >
              Aleph Hackathon 2026
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Prediction markets that{" "}
              <span className="text-emerald-400">
                can&apos;t be manipulated
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Polymarket uses UMA token-weighted human voters for resolution.
              Whales manipulate outcomes. TruthMarket replaces them with{" "}
              <span className="font-medium text-foreground">
                AI validators running diverse LLMs
              </span>{" "}
              that reach consensus by fetching real data. No whales. No bribes.
              Just truth.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Card className="border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-red-400">
                Polymarket / UMA
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Token-weighted human voters</li>
                <li>Whales can outvote everyone</li>
                <li>Slow dispute resolution</li>
                <li>Susceptible to bribery</li>
              </ul>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-400">
                TruthMarket / GenLayer
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>AI validators with diverse LLMs</li>
                <li>Can&apos;t bribe or accumulate votes</li>
                <li>Auto-resolution from real data</li>
                <li>Transparent reasoning on-chain</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Markets</h3>
          {isLive && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Live on GenLayer
            </Badge>
          )}
        </div>

        {isLive && market && odds ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MarketCard market={market} />
              <Card className="mt-4 p-5 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Resolution Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Criteria: </span>
                    <span>{market.resolution_criteria}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sources: </span>
                    <span className="font-mono text-xs break-all">
                      {market.resolution_sources}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
            <div>
              <TradePanel
                market={market}
                odds={odds}
                contractAddress={CONTRACT_ADDRESS}
                onTrade={loadMarket}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Demo markets showing the TruthMarket concept. Deploy a contract to
              go live.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                {DEMO_MARKETS.map((m, i) => (
                  <MarketCard
                    key={i}
                    market={m}
                    onClick={() => setSelectedDemo(i)}
                  />
                ))}
              </div>
              <div>
                {selectedDemo !== null ? (
                  <Card className="p-5 space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Market Details
                    </h3>
                    <div className="space-y-3 text-sm">
                      <p className="font-medium">
                        {DEMO_MARKETS[selectedDemo].title}
                      </p>
                      <div>
                        <span className="text-muted-foreground">
                          Resolution Criteria:{" "}
                        </span>
                        <span>
                          {DEMO_MARKETS[selectedDemo].resolution_criteria}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          AI Validator Sources:{" "}
                        </span>
                        <code className="text-xs break-all">
                          {DEMO_MARKETS[selectedDemo].resolution_sources}
                        </code>
                      </div>
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                        <p className="text-xs text-blue-400 font-medium">
                          How Resolution Works
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          When triggered, GenLayer validators independently
                          fetch data from the sources above, evaluate against
                          the criteria using different LLMs, and reach
                          consensus. No human voters. No token-weighted
                          manipulation.
                        </p>
                      </div>
                    </div>
                    <Button className="w-full" disabled>
                      Deploy Contract to Trade
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-5 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
                    <p className="text-sm text-muted-foreground">
                      Select a market to view details
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-border/40 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h3 className="text-xl font-semibold mb-8">
            Why AI Resolution is Better
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-5 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-mono font-bold">
                1
              </div>
              <h4 className="font-medium">No Whale Manipulation</h4>
              <p className="text-sm text-muted-foreground">
                AI validators can&apos;t accumulate tokens to outvote others.
                Each validator runs independently with its own LLM. No economic
                attack vector.
              </p>
            </Card>
            <Card className="p-5 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-mono font-bold">
                2
              </div>
              <h4 className="font-medium">Real Data Verification</h4>
              <p className="text-sm text-muted-foreground">
                Validators fetch actual data from trusted sources (CoinMarketCap,
                news sites, APIs). Resolution is based on facts, not votes.
              </p>
            </Card>
            <Card className="p-5 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 font-mono font-bold">
                3
              </div>
              <h4 className="font-medium">Transparent Reasoning</h4>
              <p className="text-sm text-muted-foreground">
                Every resolution includes on-chain reasoning explaining why the
                outcome was determined. Full auditability, unlike opaque human
                voting.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>TruthMarket | Built for Aleph Hackathon 2026</p>
          <p className="font-mono">Powered by GenLayer AI Consensus</p>
        </div>
      </footer>
    </div>
  );
}
