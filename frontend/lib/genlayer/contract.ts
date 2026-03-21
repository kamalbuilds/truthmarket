import { createGenLayerClient, CONTRACT_ADDRESS } from "./client";
import type { MarketInfo, UserPosition, MarketOdds } from "./client";

export class TruthMarketContract {
  private client: ReturnType<typeof createGenLayerClient>;
  private address: `0x${string}`;

  constructor(contractAddress?: string, account?: string) {
    this.address = (contractAddress || CONTRACT_ADDRESS) as `0x${string}`;
    this.client = createGenLayerClient(account || undefined);
  }

  async getMarketInfo(): Promise<MarketInfo> {
    const result = await this.client.readContract({
      address: this.address,
      functionName: "get_market_info",
      args: [],
    });
    return result as unknown as MarketInfo;
  }

  async getOdds(): Promise<MarketOdds> {
    const result = await this.client.readContract({
      address: this.address,
      functionName: "get_odds",
      args: [],
    });
    return result as unknown as MarketOdds;
  }

  async getUserPosition(userAddress: string): Promise<UserPosition> {
    const result = await this.client.readContract({
      address: this.address,
      functionName: "get_user_position",
      args: [userAddress],
    });
    return result as unknown as UserPosition;
  }

  async placeBet(side: string, amount: bigint) {
    const txHash = await this.client.writeContract({
      address: this.address,
      functionName: "place_bet",
      args: [side],
      value: amount,
    });
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as never,
      retries: 24,
      interval: 5000,
    });
    return receipt;
  }

  async resolve() {
    const txHash = await this.client.writeContract({
      address: this.address,
      functionName: "resolve",
      args: [],
      value: BigInt(0),
    });
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as never,
      retries: 60,
      interval: 10000,
    });
    return receipt;
  }

  async claim() {
    const txHash = await this.client.writeContract({
      address: this.address,
      functionName: "claim",
      args: [],
      value: BigInt(0),
    });
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as never,
      retries: 24,
      interval: 5000,
    });
    return receipt;
  }

  async claimRefund() {
    const txHash = await this.client.writeContract({
      address: this.address,
      functionName: "claim_refund",
      args: [],
      value: BigInt(0),
    });
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as never,
      retries: 24,
      interval: 5000,
    });
    return receipt;
  }
}
