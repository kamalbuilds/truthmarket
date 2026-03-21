/**
 * Configuration script for BridgeForwarder contract.
 *
 * Usage:
 *   npx hardhat run scripts/configure.ts --network zkSyncSepoliaTestnet
 *
 * Required env vars:
 *   BRIDGE_FORWARDER_ADDRESS - Address of deployed BridgeForwarder
 *   DST_EID - Destination chain LayerZero endpoint ID
 *   DST_BRIDGE_ADDRESS - Address of receiver on destination chain
 */

import { getEnvVar, validateAddress, addressToBytes32, getContract } from "./utils";
import { ethers } from "hardhat";

/**
 * Set bridge address on BridgeForwarder
 * Required env: BRIDGE_FORWARDER_ADDRESS, DST_EID, DST_BRIDGE_ADDRESS
 */
async function setBridgeAddress() {
  const forwarderAddress = getEnvVar("BRIDGE_FORWARDER_ADDRESS");
  const dstEid = parseInt(getEnvVar("DST_EID"));
  const dstBridgeAddress = getEnvVar("DST_BRIDGE_ADDRESS");

  validateAddress(forwarderAddress, "BRIDGE_FORWARDER_ADDRESS");
  validateAddress(dstBridgeAddress, "DST_BRIDGE_ADDRESS");

  console.log("\nSetting bridge address on BridgeForwarder");
  console.log("  Forwarder:", forwarderAddress);
  console.log("  Destination EID:", dstEid);
  console.log("  Destination Bridge:", dstBridgeAddress);

  const forwarder = await getContract("BridgeForwarder", forwarderAddress);
  const bridgeBytes32 = addressToBytes32(dstBridgeAddress);

  const tx = await forwarder.setBridgeAddress(dstEid, bridgeBytes32);
  console.log("  TX:", tx.hash);

  await tx.wait();
  console.log("  ✓ Bridge address set successfully");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  await setBridgeAddress();
}

main().catch((error) => {
  console.error("\nConfiguration failed!");
  console.error(error);
  process.exitCode = 1;
});
