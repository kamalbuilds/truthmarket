"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MarketInfo } from "@/lib/genlayer/client";
import { ProbabilityGauge } from "@/components/probability-gauge";

function formatPool(amount: number): string {
  if (amount === 0) return "0 GEN";
  if (amount < 1000) return `${amount} GEN`;
  if (amount < 1_000_000) return `${(amount / 1000).toFixed(1)}K GEN`;
  return `${(amount / 1_000_000).toFixed(1)}M GEN`;
}

export function MarketCard({
  market,
  onClick,
}: {
  market: MarketInfo;
  onClick?: () => void;
}) {
  const prob = market.probability_a_pct;
  const isResolved = market.is_resolved;
  const isCancelled = market.is_cancelled;
  const isActive = !isResolved && !isCancelled;

  return (
    <Card
      className="group cursor-pointer border-border/50 bg-card/50 p-5 transition-all hover:border-border hover:bg-card"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: status + title + description */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge
                variant="secondary"
                className="bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1.5"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
                </span>
                Active
              </Badge>
            )}
            {isResolved && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1.5"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Resolved
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="destructive" className="flex items-center gap-1.5">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Cancelled
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

        {/* Right: Probability gauge */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 pt-1">
          <ProbabilityGauge
            probabilityPct={prob}
            sideALabel={market.side_a}
            size="md"
          />
          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[80px] text-center leading-tight">
            {market.side_a}
          </span>
        </div>
      </div>

      {/* Footer: pool + end date + probability bar */}
      <div className="mt-4 space-y-3">
        {/* Probability bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-400">{market.side_a}</span>
            <span className="text-muted-foreground">{market.side_b}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${prob}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{prob}%</span>
            <span>{market.probability_b_pct}%</span>
          </div>
        </div>

        {/* Pool + date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="font-medium text-foreground/70">
            {formatPool(market.total_pool)} pool
          </span>
          <span>Ends {market.end_date}</span>
        </div>
      </div>

      {/* Resolution result */}
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
