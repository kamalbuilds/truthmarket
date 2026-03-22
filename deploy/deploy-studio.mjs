import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables from .env file
config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const USE_BRADBURY = process.argv.includes("--bradbury");

async function main() {
  if (!PRIVATE_KEY) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY not set in .env file");
    console.error("Create a .env file at project root with:");
    console.error("  DEPLOYER_PRIVATE_KEY=0xyour_key_here");
    process.exit(1);
  }

  const chain = USE_BRADBURY ? testnetBradbury : studionet;
  const networkName = USE_BRADBURY ? "Bradbury Testnet" : "Studio";
  console.log(`Deploying TruthMarket to GenLayer ${networkName}...\n`);

  const account = createAccount(PRIVATE_KEY);
  console.log("Account:", account.address);

  const client = createClient({
    chain,
    account,
  });

  const contractPath = resolve(process.cwd(), "contracts/truth_market.py");
  const contractCode = readFileSync(contractPath);

  const args = [
    "Will Bitcoin exceed $100,000 by March 31, 2026?",
    "Resolves based on BTC/USD price on CoinMarketCap at end of March 31, 2026 UTC.",
    "Check BTC price on CoinMarketCap. If price >= $100,000, side_a (Yes) wins. Otherwise side_b (No) wins.",
    "https://coinmarketcap.com/currencies/bitcoin/",
    "Yes, above $100K",
    "No, below $100K",
    "2026-03-31",
  ];

  console.log("Deploying with args:", args);
  console.log("");

  try {
    const txHash = await client.deployContract({
      code: new Uint8Array(contractCode),
      args,
    });

    console.log("Transaction hash:", txHash);
    console.log("Waiting for confirmation...");

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED",
      retries: 60,
      interval: 5000,
    });

    const contractAddress =
      receipt?.data?.contract_address ||
      receipt?.txDataDecoded?.contractAddress;

    console.log("\n========================================");
    console.log("SUCCESS! Contract deployed!");
    console.log("Address:", contractAddress);
    console.log("========================================\n");
    console.log("Set in frontend/.env.local:");
    console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  } catch (err) {
    console.error("Deployment failed:", err.message || err);
    if (err.cause) console.error("Cause:", err.cause);
  }
}

main();
