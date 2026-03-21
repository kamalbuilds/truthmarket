#!/usr/bin/env node
/**
 * Bridge Service CLI - Debug and inspection tool
 *
 * Usage:
 *   npx ts-node cli.ts <command> [args]
 *
 * Commands:
 *   check-forwarder          - Check zkSync BridgeForwarder state
 *   check-config             - Verify configuration
 *   debug-tx <hash>          - Debug a transaction (show revert reason)
 *   help                     - Show this help message
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // RPCs
  zkSyncRpc: process.env.FORWARDER_NETWORK_RPC_URL || "https://sepolia.era.zksync.dev",
  genlayerRpc: process.env.GENLAYER_RPC_URL || "https://studio-stage.genlayer.com/api",

  // Contracts
  bridgeForwarder: process.env.BRIDGE_FORWARDER_ADDRESS || "",
  bridgeSenderIc: process.env.BRIDGE_SENDER_ADDRESS || "",
};

// ABIs
const BRIDGE_FORWARDER_ABI = [
  "function bridgeAddresses(uint32) external view returns (bytes32)",
  "function isHashUsed(bytes32) external view returns (bool)",
  "function endpoint() external view returns (address)",
  "function owner() external view returns (address)",
  "function caller() external view returns (address)",
];

// ============================================================================
// Commands
// ============================================================================

async function checkForwarder() {
  console.log("Checking zkSync BridgeForwarder...\n");

  if (!CONFIG.bridgeForwarder) {
    console.error("BRIDGE_FORWARDER_ADDRESS not set");
    return;
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.zkSyncRpc);
  const contract = new ethers.Contract(
    CONFIG.bridgeForwarder,
    BRIDGE_FORWARDER_ABI,
    provider
  );

  console.log("Address:", CONFIG.bridgeForwarder);

  const endpoint = await contract.endpoint();
  console.log("LZ Endpoint:", endpoint);

  const owner = await contract.owner();
  console.log("Owner:", owner);

  const caller = await contract.caller();
  console.log("Caller:", caller);

  // Check bridge addresses
  console.log("\nBridge Addresses:");
  for (const [name, eid] of [
    ["Base Sepolia", 40245],
    ["Base Mainnet", 30184],
  ]) {
    const bridge = await contract.bridgeAddresses(eid);
    if (bridge !== ethers.ZeroHash) {
      const addr = "0x" + bridge.slice(-40);
      console.log(`  ${name} (${eid}): ${addr}`);
    }
  }
}

async function checkConfig() {
  console.log("Verifying Bridge Configuration...\n");

  console.log("Environment:");
  console.log("  zkSync RPC:", CONFIG.zkSyncRpc);
  console.log("  GenLayer RPC:", CONFIG.genlayerRpc);
  console.log("");
  console.log("Contracts:");
  console.log("  BridgeForwarder:", CONFIG.bridgeForwarder || "(not set)");
  console.log("  BridgeSender IC:", CONFIG.bridgeSenderIc || "(not set)");
  console.log("");

  // Check forwarder has code
  if (CONFIG.bridgeForwarder) {
    const provider = new ethers.JsonRpcProvider(CONFIG.zkSyncRpc);
    const code = await provider.getCode(CONFIG.bridgeForwarder);
    const hasCode = code !== "0x";
    console.log(`Contract Code: ${hasCode ? "✓" : "✗ NO CODE"}`);
  }
}

async function debugTx(txHash: string) {
  console.log(`Debugging Transaction: ${txHash}\n`);

  const provider = new ethers.JsonRpcProvider(CONFIG.zkSyncRpc);

  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.log("Transaction not found on zkSync");
      return;
    }

    console.log("Found on zkSync");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("  Gas Used:", receipt.gasUsed.toString());
    console.log("  Logs:", receipt.logs.length);

    if (receipt.status === 0) {
      // Try to get revert reason
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        try {
          await provider.call(
            {
              to: tx.to,
              data: tx.data,
              value: tx.value,
            },
            tx.blockNumber
          );
        } catch (e: any) {
          console.log("\nRevert Reason:", e.reason || e.message);
        }
      }
    }
  } catch {
    console.log("Transaction not found");
  }
}

function showHelp() {
  console.log(`
Bridge Service CLI (GenLayer → EVM)

Usage: npx ts-node cli.ts <command> [args]

Commands:
  check-forwarder          Check zkSync BridgeForwarder state
  check-config             Verify configuration
  debug-tx <hash>          Debug a transaction
  help                     Show this help message

Environment:
  Set these in .env:
    FORWARDER_NETWORK_RPC_URL, GENLAYER_RPC_URL
    BRIDGE_FORWARDER_ADDRESS, BRIDGE_SENDER_ADDRESS
`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const [, , command, ...args] = process.argv;

  try {
    switch (command) {
      case "check-forwarder":
        await checkForwarder();
        break;
      case "check-config":
        await checkConfig();
        break;
      case "debug-tx":
        if (!args[0]) {
          console.error("Usage: debug-tx <transaction_hash>");
          process.exit(1);
        }
        await debugTx(args[0]);
        break;
      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;
      default:
        if (command) {
          console.error(`Unknown command: ${command}\n`);
        }
        showHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (error: any) {
    console.error("Error:", error.message || error);
    process.exit(1);
  }
}

main();
