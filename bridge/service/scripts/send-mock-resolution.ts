/**
 * Send a mock resolution message from GenLayer BridgeSender
 *
 * Usage:
 *   BET_ADDRESS=0x... npx tsx scripts/send-mock-resolution.ts
 *   BET_ADDRESS=0x... SIDE_A_WINS=true npx tsx scripts/send-mock-resolution.ts
 */

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { AbiCoder } from "ethers";
import {
  getGenlayerRpcUrl,
  getPrivateKey,
  getBridgeSenderAddress,
  getBetFactoryAddress,
} from "../src/config.js";

// Contract addresses
const BASE_SEPOLIA_LZ_EID = 40245;

async function main() {
  const betAddress = process.env.BET_ADDRESS;
  if (!betAddress) {
    console.error("Usage: BET_ADDRESS=0x... npx tsx scripts/send-mock-resolution.ts");
    process.exit(1);
  }

  const sideAWins = process.env.SIDE_A_WINS !== "false"; // Default to true
  const isUndetermined = process.env.IS_UNDETERMINED === "true"; // Default to false

  console.log("Sending mock resolution from GenLayer\n");
  console.log("Configuration:");
  console.log(`  BridgeSender: ${getBridgeSenderAddress()}`);
  console.log(`  Target Chain: Base Sepolia (EID: ${BASE_SEPOLIA_LZ_EID})`);
  console.log(`  Target Contract: ${getBetFactoryAddress()}`);
  console.log(`  Bet Address: ${betAddress}`);
  console.log(`  Side A Wins: ${sideAWins}`);
  console.log(`  Is Undetermined: ${isUndetermined}`);

  // Create GenLayer client
  const privateKey = getPrivateKey();
  const account = createAccount(`0x${privateKey.replace(/^0x/, "")}`);
  const client = createClient({
    chain: {
      ...studionet,
      rpcUrls: {
        default: { http: [getGenlayerRpcUrl()] },
      },
    },
    account,
  });

  // Encode the resolution data
  // BetCOFI.setResolution expects: (address betAddress, bool sideAWins, bool isUndetermined, uint256 timestamp, bytes32 txHash)
  const abiCoder = AbiCoder.defaultAbiCoder();
  const timestamp = Math.floor(Date.now() / 1000);
  const txHash = "0x" + "00".repeat(32); // Mock tx hash

  const resolutionData = abiCoder.encode(
    ["address", "bool", "bool", "uint256", "bytes32"],
    [betAddress, sideAWins, isUndetermined, timestamp, txHash]
  );

  // BetFactoryCOFI.processBridgeMessage expects: (address targetContract, bytes data)
  const message = abiCoder.encode(
    ["address", "bytes"],
    [betAddress, resolutionData]
  );

  console.log(`\nEncoded message:`);
  console.log(`  Resolution data: ${resolutionData.slice(0, 66)}...`);
  console.log(`  Full message: ${message.slice(0, 66)}...`);

  // Convert message to bytes for GenLayer
  const messageBytes = Buffer.from(message.slice(2), "hex");

  console.log(`\nSending to BridgeSender...`);

  try {
    const hash = await client.writeContract({
      address: getBridgeSenderAddress() as any,
      functionName: "send_message",
      args: [BASE_SEPOLIA_LZ_EID, getBetFactoryAddress(), messageBytes],
    });

    console.log(`\n✅ Message sent!`);
    console.log(`  TX Hash: ${hash}`);

    // Wait for confirmation
    console.log(`\nWaiting for confirmation...`);
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 30,
      interval: 2000,
    });

    console.log(`✅ Transaction confirmed!`);
    console.log(`  Status: ${receipt.status}`);

    // Get the message hash from the return value if available
    if (receipt.data?.result) {
      console.log(`  Message Hash: ${receipt.data.result}`);
    }

    console.log(`\nNext steps:`);
    console.log(`1. Start the bridge service: npm start`);
    console.log(`2. Wait for the message to be relayed to Base Sepolia`);
    console.log(`3. Verify the bet status changed to RESOLVED`);

  } catch (error: any) {
    console.error("\n❌ Failed to send message:", error?.message || error);
    process.exit(1);
  }
}

main();
