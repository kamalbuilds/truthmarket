"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MarketInfo } from "@/lib/genlayer/client";

function formatPool(amount: number): string {
  if (amount === 0) return "0";
  if (amount < 1000) return amount.toString();
  if (amount < 1_000_000) return `${(amount / 1000).toFixed(1)}K`;
  return `${(amount / 1_000_000).toFixed(1)}M`;
}

export function MarketCard({
  market,
  onClick,
}: {
  market: MarketInfo;
  onClick?: () => void;
}) {
  const prob = Math.round(market.probability_a * 100);
  const isResolved = market.is_resolved;
  const isCancelled = market.is_cancelled;

  return (
    <Card
      className="group cursor-pointer border-border/50 bg-card/50 p-5 transition-all hover:border-border hover:bg-card"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {isResolved && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                Resolved
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
            {!isResolved && !isCancelled && (
              <Badge
                variant="secondary"
                className="bg-blue-500/10 text-blue-400 border-blue-500/20"
              >
                Active
              </Badge>
            )}
          </div>
          <h3 className="text-base font-medium leading-snug group-hover:text-primary transition-colors">
            {market.title}
          </h3>
          {market.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {market.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-2xl font-mono font-bold tabular-nums">
            {prob}%
          </span>
          <span className="text-xs text-muted-foreground">
            {market.side_a}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <span>{formatPool(market.total_pool)} GEN pool</span>
          <span>Ends {market.end_date}</span>
        </div>

        {/* Probability bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${prob}%` }}
            />
          </div>
        </div>
      </div>

      {isResolved && market.winning_side && (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-mono text-emerald-400">
            Winner: {market.winning_side}
          </p>
          {market.resolution_reasoning && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {market.resolution_reasoning}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
