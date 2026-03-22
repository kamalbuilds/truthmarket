import { createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";

// Use studionet for demo, testnetBradbury for production
const CHAIN = process.env.NEXT_PUBLIC_GENLAYER_NETWORK === "bradbury" ? testnetBradbury : studionet;

export function createGenLayerClient(account?: string) {
  const config: Record<string, unknown> = { chain: CHAIN };
  if (account) {
    config.account = account as `0x${string}`;
  }
  return createClient(config);
}

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export type MarketInfo = {
  title: string;
  description: string;
  resolution_criteria: string;
  resolution_sources: string;
  side_a: string;
  side_b: string;
  creator: string;
  created_at: string;
  end_date: string;
  total_side_a: number;
  total_side_b: number;
  total_pool: number;
  probability_a_pct: number;
  probability_b_pct: number;
  is_resolved: boolean;
  is_cancelled: boolean;
  winning_side: string;
  resolution_reasoning: string;
  resolved_at: string;
};

export type UserPosition = {
  bet_side_a: number;
  bet_side_b: number;
  total_bet: number;
  has_claimed: boolean;
};

export type MarketOdds = {
  side_a_pct: number;
  side_b_pct: number;
  side_a_payout_bps: number;
  side_b_payout_bps: number;
  total_pool: number;
};
