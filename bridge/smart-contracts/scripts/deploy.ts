/**
 * Deployment script for BridgeForwarder contract.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network zkSyncSepoliaTestnet
 */

import {
  getNetworkInfo,
  logNetworkHeader,
  saveDeploymentResult,
  verifyContract,
  getEnvVar,
  validateAddress,
} from "./utils";
import { ethers } from "hardhat";

async function deployBridgeForwarder() {
  const networkInfo = await getNetworkInfo();
  logNetworkHeader("Deploying BridgeForwarder", networkInfo);

  // Validate config
  validateAddress(networkInfo.endpointAddress, "LZ Endpoint");
  const ownerAddress = getEnvVar("OWNER_ADDRESS");
  const callerAddress = getEnvVar("CALLER_ADDRESS");
  validateAddress(ownerAddress, "Owner");
  validateAddress(callerAddress, "Caller");

  console.log("\nConfiguration:");
  console.log("  Endpoint:", networkInfo.endpointAddress);
  console.log("  Owner:", ownerAddress);
  console.log("  Caller:", callerAddress);

  // Deploy
  const BridgeForwarder = await ethers.getContractFactory("BridgeForwarder");
  const contract = await BridgeForwarder.deploy(
    networkInfo.endpointAddress,
    ownerAddress,
    callerAddress
  );

  const deployTx = contract.deploymentTransaction();
  if (!deployTx) throw new Error("Deployment transaction not found");

  console.log("\nDeploying... TX:", deployTx.hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  // Save & verify
  await saveDeploymentResult({
    contract: "BridgeForwarder",
    network: networkInfo.networkName,
    chainId: Number(networkInfo.chainId),
    address,
    deploymentHash: deployTx.hash,
    params: {
      endpoint: networkInfo.endpointAddress,
      owner: ownerAddress,
      caller: callerAddress,
    },
    timestamp: new Date().toISOString(),
  });

  await verifyContract(address, [
    networkInfo.endpointAddress,
    ownerAddress,
    callerAddress,
  ]);

  console.log("\n✓ BridgeForwarder deployed to:", address);
  return address;
}

async function main() {
  await deployBridgeForwarder();
}

main().catch((error) => {
  console.error("\nDeployment failed!");
  console.error(error);
  process.exitCode = 1;
});
