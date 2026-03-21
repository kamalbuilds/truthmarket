/**
 * Test script: Deploy Oracle to GenLayer
 *
 * This script deploys a crypto oracle directly to GenLayer to test:
 * 1. Oracle deployment and price resolution
 * 2. Bridge message sent to BridgeSender
 * 3. Relay service picks up and relays to EVM
 *
 * Usage: npx tsx scripts/test-deploy-oracle.ts [--token <symbol>] [--name <name>]
 *
 * Examples:
 *   npx tsx scripts/test-deploy-oracle.ts
 *   npx tsx scripts/test-deploy-oracle.ts --token ETH --name ethereum
 */

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const BASE_SEPOLIA_LZ_EID = 40245;

function getConfig() {
  const genlayerRpcUrl = process.env.GENLAYER_RPC_URL;
  const bridgeSenderAddress = process.env.BRIDGE_SENDER_ADDRESS;
  const betFactoryAddress = process.env.BET_FACTORY_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;

  if (!genlayerRpcUrl || !bridgeSenderAddress || !betFactoryAddress || !privateKey) {
    throw new Error("Missing required env vars: GENLAYER_RPC_URL, BRIDGE_SENDER_ADDRESS, BET_FACTORY_ADDRESS, PRIVATE_KEY");
  }

  return { genlayerRpcUrl, bridgeSenderAddress, betFactoryAddress, privateKey };
}

function parseArgs(): { tokenSymbol: string; tokenName: string } {
  const args = process.argv.slice(2);
  let tokenSymbol = "BTC";
  let tokenName = "bitcoin";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && args[i + 1]) {
      tokenSymbol = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === "--name" && args[i + 1]) {
      tokenName = args[i + 1].toLowerCase();
      i++;
    }
  }

  return { tokenSymbol, tokenName };
}

function generateMockBetAddress(): string {
  // Generate a random address for testing (not a real bet contract)
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  return "0x" + Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const config = getConfig();
  const { tokenSymbol, tokenName } = parseArgs();

  console.log("\n========================================");
  console.log("  Test Oracle Deployment");
  console.log("========================================");
  console.log(`GenLayer RPC: ${config.genlayerRpcUrl}`);
  console.log(`Bridge Sender: ${config.bridgeSenderAddress}`);
  console.log(`Target Contract: ${config.betFactoryAddress}`);
  console.log(`Target Chain EID: ${BASE_SEPOLIA_LZ_EID}`);

  // Create GenLayer client
  const account = createAccount(`0x${config.privateKey.replace(/^0x/, "")}`);
  const client = createClient({
    chain: {
      ...studionet,
      rpcUrls: {
        default: { http: [config.genlayerRpcUrl] },
      },
    },
    account,
  });

  console.log(`\nAccount: ${account.address}`);

  // Test parameters
  const mockBetAddress = generateMockBetAddress();
  const marketTitle = `Will ${tokenSymbol} exceed $100,000 by end of 2025?`;
  const sideA = "Yes, above $100k";
  const sideB = "No, below $100k";

  console.log("\n--- Test Parameters ---");
  console.log(`Mock Bet Address: ${mockBetAddress}`);
  console.log(`Token: ${tokenSymbol} (${tokenName})`);
  console.log(`Title: ${marketTitle}`);
  console.log(`Side A: ${sideA}`);
  console.log(`Side B: ${sideB}`);

  // Load oracle contract code
  const oraclePath = path.join(import.meta.dirname, "../intelligent-oracles/crypto_prediction_market.py");
  console.log(`\nLoading oracle from: ${oraclePath}`);
  const oracleCode = readFileSync(oraclePath, "utf-8");

  // Constructor args
  const args = [
    mockBetAddress,           // market_id (bet contract address)
    tokenSymbol,              // token_symbol
    tokenName,                // token_name
    marketTitle,              // market_title
    sideA,                    // side_a
    sideB,                    // side_b
    config.bridgeSenderAddress,  // bridge_sender
    BASE_SEPOLIA_LZ_EID,      // target_chain_eid
    config.betFactoryAddress, // target_contract
  ];

  console.log("\n--- Deploying Oracle ---");
  console.log("This will:");
  console.log("  1. Deploy oracle to GenLayer");
  console.log(`  2. Oracle fetches ${tokenSymbol} price from CoinMarketCap`);
  console.log("  3. Determine winner based on price vs $100k");
  console.log("  4. Send resolution to BridgeSender");
  console.log("  5. Relay service picks up message and relays to EVM");

  try {
    const hash = await client.deployContract({
      code: oracleCode,
      args,
      leaderOnly: false,
    });

    console.log(`\nDeploy TX Hash: ${hash}`);
    console.log("Waiting for deployment (this may take 30-60 seconds)...");

    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 60,
      interval: 2000,
    });

    const oracleAddress = receipt.data?.contract_address;
    console.log(`\n--- Deployment Complete ---`);
    console.log(`Oracle Address: ${oracleAddress}`);
    console.log(`Status: ${receipt.status}`);

    const isAccepted = receipt.status === 5 || receipt.status_name === "ACCEPTED";
    if (isAccepted && oracleAddress) {
      // Read the resolution details
      console.log("\n--- Fetching Resolution Details ---");
      const result = await client.readContract({
        address: oracleAddress,
        functionName: "get_resolution_details",
        args: [],
      });
      console.log("Resolution:", JSON.stringify(result, null, 2));

      console.log("\n--- Next Steps ---");
      console.log("1. Check the relay service logs for:");
      console.log("   [GL→EVM] Found 1 new messages");
      console.log("   [GL→EVM] Relaying message...");
      console.log("2. The message should be sent via zkSync -> LayerZero -> Base Sepolia");
      console.log(`3. Target: BetFactoryCOFI.setResolution(${mockBetAddress}, ...)`);
      console.log("\nNote: Since this is a mock bet address, the setResolution call");
      console.log("will likely revert (bet not found), but the relay should still work.");
    } else {
      console.log("\nDeployment may have failed. Check GenLayer explorer for details.");
      console.log("Receipt:", JSON.stringify(receipt, null, 2));
    }
  } catch (error) {
    console.error("\nDeployment error:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
