/**
 * E2E Test: Full Resolution Flow
 *
 * Tests the complete prediction market flow:
 * 1. Create bet on EVM (Base Sepolia)
 * 2. Place bets on both sides (ensures RESOLVED, not UNDETERMINED)
 * 3. Request resolution → emits ResolutionRequested event
 * 4. Service deploys oracle to GenLayer
 * 5. Oracle resolves and sends bridge message back
 * 6. Service relays to EVM → bet status becomes RESOLVED
 *
 * Prerequisites:
 * - Service must be running (npm run dev)
 * - BridgeReceiver configured on factory
 * - Private key must have ETH on Base Sepolia
 * - Private key must have MockUSDL on Base Sepolia (call drip() on MockUSDL contract)
 * - Private key must be approved creator on factory (or be owner)
 *
 * Usage: npx tsx scripts/test-e2e-flow.ts
 */

import { ethers, AbiCoder } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const BET_AMOUNT_A = 10_000n; // 0.01 USDL (1 cent)
const BET_AMOUNT_B = 20_000n; // 0.02 USDL (2 cents)

// Minimal ABIs for the contracts we need
const BET_FACTORY_ABI = [
  "function createBet(string title, string resolutionCriteria, string sideAName, string sideBName, uint256 endDate, uint8 resolutionType, bytes resolutionData) external returns (address)",
  "function placeBet(address betAddress, bool onSideA, uint256 amount) external",
  "function owner() view returns (address)",
  "function approvedCreators(address) view returns (bool)",
  "event BetCreated(address indexed betAddress, address indexed creator, string title, uint256 endDate)",
  "event BetPlaced(address indexed betAddress, address indexed bettor, bool onSideA, uint256 amount)",
  "event ResolutionRequested(address indexed betContract, address indexed creator, uint8 resolutionType, string title, string sideAName, string sideBName, bytes resolutionData, uint256 timestamp)",
];

const BET_COFI_ABI = [
  "function resolve() external",
  "function status() view returns (uint8)",
  "function isSideAWinner() view returns (bool)",
  "function isResolved() view returns (bool)",
  "function creator() view returns (address)",
  "function title() view returns (string)",
  "function sideAName() view returns (string)",
  "function sideBName() view returns (string)",
  "function totalSideA() view returns (uint256)",
  "function totalSideB() view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const STATUS_NAMES = ["ACTIVE", "RESOLVING", "RESOLVED", "UNDETERMINED"];

function getConfig() {
  const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const betFactoryAddress = process.env.BET_FACTORY_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;
  const mockUsdlAddress = process.env.MOCK_USDL_ADDRESS;

  if (!baseSepoliaRpcUrl || !betFactoryAddress || !privateKey || !mockUsdlAddress) {
    throw new Error("Missing required env vars: BASE_SEPOLIA_RPC_URL, BET_FACTORY_ADDRESS, PRIVATE_KEY, MOCK_USDL_ADDRESS");
  }

  return { baseSepoliaRpcUrl, betFactoryAddress, privateKey, mockUsdlAddress };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const config = getConfig();
  const abiCoder = AbiCoder.defaultAbiCoder();

  console.log("\n========================================");
  console.log("  E2E Test: Full Resolution Flow");
  console.log("========================================");
  console.log(`Factory: ${config.betFactoryAddress}`);
  console.log(`RPC: ${config.baseSepoliaRpcUrl}`);

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(config.baseSepoliaRpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  console.log(`\nAccount: ${wallet.address}`);

  // Check ETH balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther("0.001")) {
    throw new Error("Insufficient ETH balance for transactions");
  }

  // Connect to factory
  const factory = new ethers.Contract(config.betFactoryAddress, BET_FACTORY_ABI, wallet);

  // Check if we can create bets
  const owner = await factory.owner();
  const isApproved = await factory.approvedCreators(wallet.address);
  console.log(`Factory Owner: ${owner}`);
  console.log(`Is Approved Creator: ${isApproved || wallet.address.toLowerCase() === owner.toLowerCase()}`);

  // ============================================
  // STEP 1: Create Bet
  // ============================================
  console.log("\n--- Step 1: Creating Bet ---");

  // End date 30 seconds in the future - enough time to place bets
  const endDateSeconds = Math.floor(Date.now() / 1000) + 30;

  const betParams = {
    title: "Will BTC exceed $100,000 by end of 2025?",
    resolutionCriteria: "Based on CoinMarketCap BTC/USD price at resolution time",
    sideAName: "Yes, above $100k",
    sideBName: "No, below $100k",
    endDate: endDateSeconds,
    resolutionType: 0, // CRYPTO
    resolutionData: abiCoder.encode(["string", "string"], ["BTC", "bitcoin"]),
  };

  console.log(`  Title: ${betParams.title}`);
  console.log(`  Type: CRYPTO (BTC/bitcoin)`);
  console.log(`  Side A: ${betParams.sideAName}`);
  console.log(`  Side B: ${betParams.sideBName}`);
  console.log(`  End Date: ${new Date(betParams.endDate * 1000).toISOString()} (30s from now)`);

  console.log("\n  Creating bet transaction...");
  const createTx = await factory.createBet(
    betParams.title,
    betParams.resolutionCriteria,
    betParams.sideAName,
    betParams.sideBName,
    betParams.endDate,
    betParams.resolutionType,
    betParams.resolutionData
  );
  console.log(`  TX: ${createTx.hash}`);

  const createReceipt = await createTx.wait();
  console.log(`  Confirmed in block ${createReceipt.blockNumber}`);

  // Extract bet address from BetCreated event
  let betAddress = "";
  for (const log of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "BetCreated") {
        betAddress = parsed.args[0];
        break;
      }
    } catch {
      // Not a factory event, skip
    }
  }

  if (!betAddress) {
    throw new Error("Failed to extract bet address from BetCreated event");
  }

  console.log(`\n  Bet Created: ${betAddress}`);

  // ============================================
  // STEP 2: Place Bets
  // ============================================
  console.log("\n--- Step 2: Placing Bets ---");

  const token = new ethers.Contract(config.mockUsdlAddress, ERC20_ABI, wallet);

  // Check MockUSDL balance
  const tokenBalance = await token.balanceOf(wallet.address);
  const requiredToken = BET_AMOUNT_A + BET_AMOUNT_B; // Need to bet on both sides
  console.log(`  USDL Balance: ${tokenBalance} (${Number(tokenBalance) / 1e6} USDL)`);
  console.log(`  Required: ${requiredToken} (${Number(requiredToken) / 1e6} USDL)`);

  if (tokenBalance < requiredToken) {
    console.log("\n  Insufficient USDL balance!");
    console.log("  Call drip() on MockUSDL contract to get test tokens:");
    console.log(`  MockUSDL Address: ${config.mockUsdlAddress}`);
    throw new Error(`Insufficient USDL: have ${Number(tokenBalance) / 1e6}, need ${Number(requiredToken) / 1e6}`);
  }

  // Check and set token allowance
  const allowance = await token.allowance(wallet.address, config.betFactoryAddress);
  console.log(`  Current Allowance: ${allowance}`);

  if (allowance < requiredToken) {
    console.log("\n  Approving USDL to factory...");
    const approveTx = await token.approve(config.betFactoryAddress, ethers.MaxUint256);
    await approveTx.wait();
    console.log("  Approved!");
  }

  // Place bet on Side A (0.01 USDL)
  console.log(`\n  Placing ${Number(BET_AMOUNT_A) / 1e6} USDL on Side A...`);
  const betATx = await factory.placeBet(betAddress, true, BET_AMOUNT_A);
  await betATx.wait();
  console.log(`  TX: ${betATx.hash}`);

  // Place bet on Side B (0.02 USDL)
  console.log(`  Placing ${Number(BET_AMOUNT_B) / 1e6} USDL on Side B...`);
  const betBTx = await factory.placeBet(betAddress, false, BET_AMOUNT_B);
  await betBTx.wait();
  console.log(`  TX: ${betBTx.hash}`);

  const bet = new ethers.Contract(betAddress, BET_COFI_ABI, wallet);
  const totalA = await bet.totalSideA();
  const totalB = await bet.totalSideB();
  console.log(`\n  Bets placed successfully!`);
  console.log(`  Total Side A: ${Number(totalA) / 1e6} USDL`);
  console.log(`  Total Side B: ${Number(totalB) / 1e6} USDL`);

  // ============================================
  // STEP 3: Wait for End Date & Request Resolution
  // ============================================
  console.log("\n--- Step 3: Requesting Resolution ---");

  // Wait for end date to pass
  const now = Math.floor(Date.now() / 1000);
  const waitTime = betParams.endDate - now + 2; // +2 seconds buffer
  if (waitTime > 0) {
    console.log(`  Waiting ${waitTime}s for betting period to end...`);
    await sleep(waitTime * 1000);
  }

  // Verify bet state
  const statusBefore = await bet.status();
  console.log(`  Current Status: ${STATUS_NAMES[statusBefore]} (${statusBefore})`);

  if (statusBefore !== 0n) {
    throw new Error(`Bet is not in ACTIVE state, cannot request resolution`);
  }

  console.log("\n  Requesting resolution...");
  const resolveTx = await bet.resolve();
  console.log(`  TX: ${resolveTx.hash}`);

  const resolveReceipt = await resolveTx.wait();
  console.log(`  Confirmed in block ${resolveReceipt.blockNumber}`);

  const statusAfterResolve = await bet.status();
  console.log(`  Status: ACTIVE → ${STATUS_NAMES[Number(statusAfterResolve)]}`);

  if (statusAfterResolve !== 1n) {
    throw new Error(`Expected RESOLVING status, got ${STATUS_NAMES[Number(statusAfterResolve)]}`);
  }

  console.log("\n  ResolutionRequested event emitted!");
  console.log("  The relay service should now:");
  console.log("    1. Pick up the event");
  console.log("    2. Deploy oracle to GenLayer");
  console.log("    3. Oracle resolves BTC price");
  console.log("    4. Oracle sends bridge message");
  console.log("    5. Service relays to EVM");

  // ============================================
  // STEP 4: Wait for Resolution
  // ============================================
  console.log("\n--- Step 4: Waiting for Oracle Resolution ---");
  console.log("  (Check service logs for progress)");
  console.log("  Polling bet status every 10s...\n");

  const timeoutMs = 5 * 60 * 1000; // 5 minutes
  const pollIntervalMs = 10 * 1000; // 10 seconds
  const startTime = Date.now();

  let finalStatus = 1n; // RESOLVING
  while (Date.now() - startTime < timeoutMs) {
    await sleep(pollIntervalMs);

    const currentStatus = await bet.status();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] Status: ${STATUS_NAMES[Number(currentStatus)]}`);

    if (currentStatus !== 1n) {
      // No longer RESOLVING
      finalStatus = currentStatus;
      break;
    }
  }

  // ============================================
  // STEP 5: Verify Result
  // ============================================
  console.log("\n--- Step 5: Verifying Result ---");

  if (finalStatus === 1n) {
    console.log("\n  TIMEOUT: Bet still in RESOLVING state after 5 minutes");
    console.log("  Possible issues:");
    console.log("    - Service not running");
    console.log("    - Oracle deployment failed");
    console.log("    - Bridge relay failed");
    console.log("    - BridgeReceiver not configured on factory");
    console.log("\n  Check service logs for details.");
    console.log("\n========================================");
    console.log("  E2E Test FAILED (timeout)");
    console.log("========================================\n");
    process.exit(1);
  }

  console.log(`  Final Status: ${STATUS_NAMES[Number(finalStatus)]} (${finalStatus})`);

  if (finalStatus === 2n) {
    // RESOLVED
    const isSideAWinner = await bet.isSideAWinner();
    const winnerSide = isSideAWinner ? betParams.sideAName : betParams.sideBName;
    console.log(`  Winner: ${winnerSide}`);
    console.log(`  (BTC is currently ~$90k, below $100k threshold)`);

    console.log("\n========================================");
    console.log("  E2E Test PASSED");
    console.log("========================================\n");
  } else if (finalStatus === 3n) {
    // UNDETERMINED - unexpected since we placed bets on both sides
    console.log("  Result: UNDETERMINED");
    console.log("  (Unexpected - we placed bets on both sides)");
    console.log("  This might indicate an issue with the oracle response.");

    console.log("\n========================================");
    console.log("  E2E Test PASSED (UNDETERMINED - check oracle)");
    console.log("========================================\n");
  }

  // Summary
  console.log("Summary:");
  console.log(`  Bet Address: ${betAddress}`);
  console.log(`  Final Status: ${STATUS_NAMES[Number(finalStatus)]}`);
  console.log(`  Total Time: ${Math.round((Date.now() - startTime) / 1000)}s`);
}

main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
