import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const account = createAccount(PRIVATE_KEY);
const client = createClient({ chain: studionet, account });

let addr;
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.log(`  FAIL: ${msg}`);
    failed++;
  }
}

async function read(fn, args = []) {
  return client.readContract({ address: addr, functionName: fn, args });
}

async function write(fn, args = [], value = BigInt(0)) {
  const tx = await client.writeContract({ address: addr, functionName: fn, args, value });
  return client.waitForTransactionReceipt({ hash: tx, status: "ACCEPTED", retries: 30, interval: 3000 });
}

async function expectWriteError(fn, args = [], value = BigInt(0)) {
  try {
    const tx = await client.writeContract({ address: addr, functionName: fn, args, value });
    // On Studio, invalid TXs are accepted but fail at consensus
    // Check if the result indicates failure (result != 1 means not ACCEPTED)
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: tx, status: "ACCEPTED", retries: 10, interval: 3000,
      });
      // TX was accepted despite being invalid - Studio limitation
      // Verify state didn't actually change (the real validation)
      return false;
    } catch {
      return true; // TX was rejected at consensus level
    }
  } catch {
    return true; // TX was rejected at submission level
  }
}

// ─── TEST SUITE ──────────────────────────────────────────────

async function main() {
  console.log("=== TruthMarket E2E Test Suite ===\n");

  // ─── 1. DEPLOY ───
  console.log("1. Deploying contract...");
  const code = readFileSync("contracts/truth_market.py");
  const txHash = await client.deployContract({
    code: new Uint8Array(code),
    args: [
      "Test Market: Will BTC hit 100K?",
      "Test description",
      "If BTC >= 100000, Yes wins.",
      "https://coinmarketcap.com/currencies/bitcoin/",
      "Yes",
      "No",
      "2026-12-31",
    ],
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash, status: "ACCEPTED", retries: 60, interval: 3000,
  });
  addr = receipt?.data?.contract_address || receipt?.txDataDecoded?.contractAddress;
  assert(!!addr, `Contract deployed at ${addr}`);

  // ─── 2. TEST INITIAL STATE ───
  console.log("\n2. Testing initial state...");
  const info = await read("get_market_info");
  assert(info.title === "Test Market: Will BTC hit 100K?", "Title correct");
  assert(info.side_a === "Yes", "Side A correct");
  assert(info.side_b === "No", "Side B correct");
  assert(info.total_pool === 0, "Pool starts at 0");
  assert(info.probability_a_pct === 50, "Probability starts at 50%");
  assert(info.is_resolved === false, "Not resolved initially");
  assert(info.is_cancelled === false, "Not cancelled initially");
  assert(info.winning_side === "", "No winner initially");
  assert(info.creator === account.address, "Creator is deployer");

  const odds = await read("get_odds");
  assert(odds.side_a_pct === 50, "Odds 50/50 with no bets");
  assert(odds.side_b_pct === 50, "Odds 50/50 for side B");
  assert(odds.total_pool === 0, "Odds pool is 0");
  assert(odds.side_a_payout_bps === 20000, "Payout ratio is 2x");

  const pos = await read("get_user_position", [account.address]);
  assert(pos.bet_side_a === 0, "No bets initially");
  assert(pos.bet_side_b === 0, "No bets on B initially");
  assert(pos.has_claimed === false, "Not claimed initially");

  // ─── 3. TEST PLACE_BET_AMOUNT ───
  console.log("\n3. Testing place_bet_amount...");

  // Bet on Yes with 100 units
  await write("place_bet_amount", ["Yes", BigInt(100)]);
  let info2 = await read("get_market_info");
  assert(info2.total_side_a === 100, "100 bet on Yes");
  assert(info2.total_side_b === 0, "No on No side");
  assert(info2.total_pool === 100, "Pool is 100");
  assert(info2.probability_a_pct === 100, "100% probability with all bets on one side");

  // Bet on No with 50 units
  await write("place_bet_amount", ["No", BigInt(50)]);
  let info3 = await read("get_market_info");
  assert(info3.total_side_a === 100, "Still 100 on Yes");
  assert(info3.total_side_b === 50, "50 on No");
  assert(info3.total_pool === 150, "Pool is 150");
  assert(info3.probability_a_pct === 66, "66% probability (100/150)");
  assert(info3.probability_b_pct === 34, "34% for No (rounding)");

  // Additional bet on Yes
  await write("place_bet_amount", ["Yes", BigInt(50)]);
  let info4 = await read("get_market_info");
  assert(info4.total_side_a === 150, "150 on Yes (cumulative)");
  assert(info4.total_pool === 200, "Pool is 200");

  // Check user position
  let pos2 = await read("get_user_position", [account.address]);
  assert(pos2.bet_side_a === 150, "User has 150 on Yes");
  assert(pos2.bet_side_b === 50, "User has 50 on No");
  assert(pos2.total_bet === 200, "Total bet is 200");

  // Check odds
  let odds2 = await read("get_odds");
  assert(odds2.side_a_pct === 75, "75% probability (150/200)");
  assert(odds2.side_b_pct === 25, "25% for No");
  assert(odds2.total_pool === 200, "Pool confirmed 200");

  // ─── 4. TEST EDGE CASES (verify state unchanged after invalid ops) ───
  console.log("\n4. Testing edge cases...");

  // Save state before edge case tests
  const preEdgeInfo = await read("get_market_info");
  const preEdgePool = preEdgeInfo.total_pool;

  // Try invalid side
  await expectWriteError("place_bet_amount", ["Maybe", BigInt(100)]);
  let postInvalid = await read("get_market_info");
  assert(postInvalid.total_pool === preEdgePool, "Pool unchanged after invalid side bet");

  // Try zero amount
  await expectWriteError("place_bet_amount", ["Yes", BigInt(0)]);
  let postZero = await read("get_market_info");
  assert(postZero.total_pool === preEdgePool, "Pool unchanged after zero bet");

  // ─── 5. TEST CLAIM BEFORE RESOLUTION ───
  console.log("\n5. Testing claim before resolution...");
  await expectWriteError("claim");
  let postClaim = await read("get_market_info");
  assert(postClaim.is_resolved === false, "Still unresolved after early claim attempt");

  await expectWriteError("claim_refund");
  let postRefund = await read("get_market_info");
  assert(postRefund.is_resolved === false, "Still unresolved after early refund attempt");

  // ─── 6. TEST CANCEL ───
  console.log("\n6. Testing cancel...");
  // Deploy a separate contract to test cancel without affecting main market
  const cancelCode = readFileSync("contracts/truth_market.py");
  const cancelTxHash = await client.deployContract({
    code: new Uint8Array(cancelCode),
    args: [
      "Cancel Test Market",
      "desc",
      "criteria",
      "https://example.com",
      "A",
      "B",
      "2026-12-31",
    ],
  });
  const cancelReceipt = await client.waitForTransactionReceipt({
    hash: cancelTxHash, status: "ACCEPTED", retries: 30, interval: 3000,
  });
  const cancelAddr = cancelReceipt?.data?.contract_address || cancelReceipt?.txDataDecoded?.contractAddress;

  // Cancel it
  const cancelTx = await client.writeContract({
    address: cancelAddr, functionName: "cancel", args: [], value: BigInt(0),
  });
  await client.waitForTransactionReceipt({ hash: cancelTx, status: "ACCEPTED", retries: 30, interval: 3000 });

  const cancelInfo = await client.readContract({
    address: cancelAddr, functionName: "get_market_info", args: [],
  });
  assert(cancelInfo.is_cancelled === true, "Market is cancelled");

  // Try to bet on cancelled market, verify pool stays 0
  try {
    const betOnCancelled = await client.writeContract({
      address: cancelAddr, functionName: "place_bet_amount", args: ["A", BigInt(100)], value: BigInt(0),
    });
    await client.waitForTransactionReceipt({ hash: betOnCancelled, status: "ACCEPTED", retries: 10, interval: 3000 });
  } catch {
    // Expected on some environments
  }
  const cancelInfo2 = await client.readContract({
    address: cancelAddr, functionName: "get_market_info", args: [],
  });
  assert(cancelInfo2.total_pool === 0, "Cancelled market pool stays 0");

  // ─── RESULTS ───
  console.log("\n=== RESULTS ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    console.log("\nSome tests failed!");
    process.exit(1);
  } else {
    console.log("\nAll tests passed!");
  }
}

main().catch((err) => {
  console.error("Test suite failed:", err.message || err);
  process.exit(1);
});
