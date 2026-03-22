import { readFileSync } from "fs";
import path from "path";

export default async function main(client: any) {
  const contractPath = path.resolve(
    process.cwd(),
    "contracts/truth_market.py"
  );
  const contractCode = new Uint8Array(readFileSync(contractPath));

  console.log("Deploying TruthMarket contract to GenLayer...");

  // Constructor args for a demo BTC market
  const args = [
    "Will Bitcoin exceed $100,000 by March 31, 2026?", // title
    "Resolves based on BTC/USD price on CoinMarketCap at end of March 31, 2026 UTC.", // description
    "Check BTC price on CoinMarketCap. If price >= $100,000, side_a wins. Otherwise side_b wins.", // resolution_criteria
    "https://coinmarketcap.com/currencies/bitcoin/", // resolution_sources
    "Yes, above $100K", // side_a
    "No, below $100K", // side_b
    "2026-03-31", // end_date
  ];

  console.log("Constructor args:", JSON.stringify(args, null, 2));

  const deployTx = await client.deployContract({
    code: contractCode,
    args: args,
  });

  console.log("Deploy transaction hash:", deployTx);

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTx,
    status: "ACCEPTED",
    retries: 200,
  });

  const contractAddress =
    receipt?.data?.contract_address ||
    (receipt?.txDataDecoded as any)?.contractAddress;

  console.log("\n========================================");
  console.log("Contract deployed successfully!");
  console.log("Address:", contractAddress);
  console.log("========================================\n");
  console.log(
    "Add this to frontend/.env.local:"
  );
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);

  return contractAddress;
}
