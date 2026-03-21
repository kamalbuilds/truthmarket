/**
 * Check and configure GenLayer → EVM bridge path
 *
 * Usage:
 *   npx hardhat run scripts/check-gl-to-evm.ts --network zkSyncSepoliaTestnet
 *   npx hardhat run scripts/check-gl-to-evm.ts --network baseSepoliaTestnet
 */

import { ethers } from "hardhat";
import { getContract, LAYER_ZERO_EIDS, addressToBytes32, getNetworkInfo, getEnvVar } from "./utils";

// Contract addresses from env (required)
const BRIDGE_FORWARDER_ZKSYNC = process.env.BRIDGE_FORWARDER_ADDRESS;
const BRIDGE_RECEIVER_BASE = process.env.DST_BRIDGE_ADDRESS;

if (!BRIDGE_FORWARDER_ZKSYNC || !BRIDGE_RECEIVER_BASE) {
  throw new Error("Missing required env vars: BRIDGE_FORWARDER_ADDRESS, DST_BRIDGE_ADDRESS");
}

async function checkZkSync() {
  console.log("\n=== BridgeForwarder on zkSync Sepolia ===");
  console.log("Address:", BRIDGE_FORWARDER_ZKSYNC);

  const forwarder = await getContract("BridgeForwarder", BRIDGE_FORWARDER_ZKSYNC);

  // Check bridge address for Base Sepolia
  const baseEid = LAYER_ZERO_EIDS.baseSepolia;
  console.log(`\nChecking bridgeAddresses[${baseEid}] (Base Sepolia)...`);

  try {
    const configuredAddress = await forwarder.getBridgeAddress(baseEid);
    console.log(`  Configured: ${configuredAddress}`);

    const expectedAddress = addressToBytes32(BRIDGE_RECEIVER_BASE);
    console.log(`  Expected:   ${expectedAddress}`);

    if (configuredAddress.toLowerCase() === expectedAddress.toLowerCase()) {
      console.log("  ✅ BridgeForwarder is correctly configured!");
    } else {
      console.log("  ❌ MISMATCH! Need to call setBridgeAddress()");
    }
  } catch (e: any) {
    if (e.message.includes("bridge address not set")) {
      console.log("  ❌ Bridge address NOT SET for Base Sepolia!");
      console.log(`  Run: setBridgeAddress(${baseEid}, ${addressToBytes32(BRIDGE_RECEIVER_BASE)})`);
    } else {
      throw e;
    }
  }

  // Check caller role
  const [signer] = await ethers.getSigners();
  const CALLER_ROLE = await forwarder.CALLER_ROLE();
  const hasCaller = await forwarder.hasRole(CALLER_ROLE, signer.address);
  console.log(`\nCaller role for ${signer.address}: ${hasCaller ? "✅ YES" : "❌ NO"}`);
}

async function checkBase() {
  console.log("\n=== BridgeReceiver on Base Sepolia ===");
  console.log("Address:", BRIDGE_RECEIVER_BASE);

  const receiver = await getContract("BridgeReceiver", BRIDGE_RECEIVER_BASE);

  // Check trusted forwarder for zkSync
  const zkSyncEid = LAYER_ZERO_EIDS.zkSyncSepolia;
  console.log(`\nChecking trustedForwarders[${zkSyncEid}] (zkSync Sepolia)...`);

  const configuredForwarder = await receiver.trustedForwarders(zkSyncEid);
  console.log(`  Configured: ${configuredForwarder}`);

  const expectedForwarder = addressToBytes32(BRIDGE_FORWARDER_ZKSYNC);
  console.log(`  Expected:   ${expectedForwarder}`);

  if (configuredForwarder === ethers.ZeroHash) {
    console.log("  ❌ NO trusted forwarder set for zkSync Sepolia!");
    console.log(`  Run: setTrustedForwarder(${zkSyncEid}, ${expectedForwarder})`);
  } else if (configuredForwarder.toLowerCase() === expectedForwarder.toLowerCase()) {
    console.log("  ✅ BridgeReceiver is correctly configured!");
  } else {
    console.log("  ❌ MISMATCH! Need to update trusted forwarder");
  }

  // Check ownership
  const owner = await receiver.owner();
  const [signer] = await ethers.getSigners();
  console.log(`\nOwner: ${owner}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Is owner: ${owner.toLowerCase() === signer.address.toLowerCase() ? "✅ YES" : "❌ NO"}`);
}

async function main() {
  const { networkName } = await getNetworkInfo();
  const [signer] = await ethers.getSigners();

  console.log("GenLayer → EVM Bridge Path Check");
  console.log("=================================");
  console.log(`Network: ${networkName}`);
  console.log(`Signer: ${signer.address}`);

  if (networkName.includes("zkSync")) {
    await checkZkSync();
  } else if (networkName.includes("base")) {
    await checkBase();
  } else {
    console.log("Run on zkSyncSepoliaTestnet or baseSepoliaTestnet");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
