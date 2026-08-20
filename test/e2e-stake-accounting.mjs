/**
 * End-to-end test against a live StealMyPrint deployment with a POSITIVE
 * minimum stake.
 *
 * It exercises the same genlayer-js path the browser console uses
 * (writeContract with an explicit `value`) and asserts that:
 *
 *   1. min_stake is actually enforced, and a claim below it is rejected
 *   2. fund_bounty credits the model's pool by exactly the value sent
 *   3. a claim at or above min_stake is accepted from that same path
 *   4. stake and bounty accounting after the verdict is arithmetically correct
 *
 * Verdicts come from a model, so the expected accounting is derived from the
 * verdict that actually came back rather than from one assumed in advance.
 * The rules being checked are the ones in file_claim:
 *
 *   CLEAR_VIOLATION | LIKELY -> reward = min(bounty_per_hit, pool)
 *                               pool  -= reward
 *                               payout = reward + stake
 *   NO_VIOLATION             -> slashed = stake // 2
 *                               pool   += slashed
 *                               payout  = stake - slashed
 *   GRAY_ZONE | UNREADABLE   -> pool unchanged, payout = stake
 *
 * Run:  node test/e2e-stake-accounting.mjs
 */
import { readFileSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const ADDRESS =
  process.env.TEST_CONTRACT_ADDRESS ||
  JSON.parse(readFileSync("deployments.json", "utf8"))[NETWORK].address;

const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: chains[NETWORK], account });

const ONE_GEN = 10n ** 18n;
const gen = (w) => (Number(w) / Number(ONE_GEN)).toFixed(6).replace(/0+$/, "");

let passed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

const read = (fn, args = []) =>
  client.readContract({ address: ADDRESS, functionName: fn, args });

/** Returns { ok, receipt, error }. Never throws, so rejections are assertable. */
async function write(fn, args, value = 0n) {
  const started = Date.now();
  try {
    const hash = await client.writeContract({
      address: ADDRESS,
      functionName: fn,
      args,
      value,
    });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: 600,
    });
    const leader = receipt.consensus_data?.leader_receipt?.[0];
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const ok = leader?.execution_result === "SUCCESS";
    console.log(
      `  · ${fn}(value=${value}) -> ${ok ? "SUCCESS" : "ERROR"} in ${secs}s`
    );
    return { ok, receipt, error: ok ? null : JSON.stringify(leader?.result ?? {}) };
  } catch (e) {
    console.log(`  · ${fn}(value=${value}) -> threw`);
    return { ok: false, receipt: null, error: String(e) };
  }
}

const modelById = async (id) => read("get_model", [id]);

// ---------------------------------------------------------------------------
console.log(`\ncontract ${ADDRESS}`);
console.log(`network  ${NETWORK}`);
console.log(`caller   ${account.address}\n`);

const stats0 = await read("get_stats");
const minStake = BigInt(stats0.min_stake);
console.log(`min_stake ${minStake} wei (${gen(minStake)} GEN)\n`);

console.log("1) minimum stake is configured");
check("min_stake is positive", minStake > 0n, `got ${minStake}`);

// ---------------------------------------------------------------------------
console.log("\n2) register a model to claim against");
const reg = await write("register_model", [
  "E2E Stake Fixture",
  "https://openscad.org/",
  1,
]);
check("register_model accepted", reg.ok, reg.error ?? "");

const modelId = Number((await read("get_stats")).models);
const afterRegister = await modelById(modelId);
check(
  "new model starts with an empty pool",
  BigInt(afterRegister.bounty_pool) === 0n,
  `pool=${afterRegister.bounty_pool}`
);

// ---------------------------------------------------------------------------
console.log("\n3) fund_bounty moves the sent value into the pool");
const deposit = minStake * 50n; // 0.05 GEN at a 0.001 minimum
const perHit = minStake * 10n;

const poolBefore = BigInt((await modelById(modelId)).bounty_pool);
const fund = await write("fund_bounty", [modelId, perHit], deposit);
check("fund_bounty accepted with a value", fund.ok, fund.error ?? "");

const afterFund = await modelById(modelId);
check(
  "pool increased by exactly the value sent",
  BigInt(afterFund.bounty_pool) - poolBefore === deposit,
  `expected +${deposit}, got +${BigInt(afterFund.bounty_pool) - poolBefore}`
);
check(
  "bounty_per_hit stored",
  BigInt(afterFund.bounty_per_hit) === perHit,
  `expected ${perHit}, got ${afterFund.bounty_per_hit}`
);

// ---------------------------------------------------------------------------
console.log("\n4) a claim below min_stake is rejected");
const claimsBeforeReject = Number((await read("get_stats")).claims);
const tooSmall = await write(
  "file_claim",
  [modelId, "https://example.org/under-staked"],
  minStake - 1n
);
check("under-staked claim rejected", !tooSmall.ok, "it was accepted");

const claimsAfterReject = Number((await read("get_stats")).claims);
check(
  "rejected claim did not touch state",
  claimsAfterReject === claimsBeforeReject,
  `claims went ${claimsBeforeReject} -> ${claimsAfterReject}`
);

// ---------------------------------------------------------------------------
console.log("\n5) a claim at the minimum stake is accepted and settled");
const stake = minStake * 5n;

const before = {
  model: await modelById(modelId),
  hunter: await read("get_hunter", [account.address]),
};
const poolPre = BigInt(before.model.bounty_pool);
const creditsPre = BigInt(before.hunter.credits);

const claim = await write(
  "file_claim",
  [modelId, `https://www.wikipedia.org/?e2e=${Date.now()}`],
  stake
);
check("claim accepted", claim.ok, claim.error ?? "");

const claims = await read("get_claims");
const settled = claims[claims.length - 1];
const model = await modelById(modelId);
const hunter = await read("get_hunter", [account.address]);

const poolPost = BigInt(model.bounty_pool);
const creditsPost = BigInt(hunter.credits);
const payout = BigInt(settled.payout);

console.log(
  `\n  verdict ${settled.verdict} (confidence ${settled.confidence})` +
    `\n  stake   ${settled.stake}` +
    `\n  payout  ${settled.payout}` +
    `\n  pool    ${poolPre} -> ${poolPost}` +
    `\n  credits ${creditsPre} -> ${creditsPost}\n`
);

check(
  "the stake recorded is the value sent",
  BigInt(settled.stake) === stake,
  `sent ${stake}, recorded ${settled.stake}`
);

// expected accounting, derived from the verdict that actually came back
let expectedPool;
let expectedPayout;

if (settled.verdict === "CLEAR_VIOLATION" || settled.verdict === "LIKELY") {
  const reward = perHit < poolPre ? perHit : poolPre;
  expectedPool = poolPre - reward;
  expectedPayout = reward + stake;
} else if (settled.verdict === "NO_VIOLATION") {
  const slashed = stake / 2n;
  expectedPool = poolPre + slashed;
  expectedPayout = stake - slashed;
} else {
  expectedPool = poolPre;
  expectedPayout = stake;
}

check(
  `pool follows the ${settled.verdict} rule`,
  poolPost === expectedPool,
  `expected ${expectedPool}, got ${poolPost}`
);
check(
  `payout follows the ${settled.verdict} rule`,
  payout === expectedPayout,
  `expected ${expectedPayout}, got ${payout}`
);
check(
  "hunter credits increased by exactly the payout",
  creditsPost - creditsPre === payout,
  `expected +${payout}, got +${creditsPost - creditsPre}`
);

// value conservation: nothing is minted, nothing vanishes
const movedIn = stake;
const movedOut = payout + (poolPost - poolPre);
check(
  "stake is fully accounted for between payout and pool",
  movedIn === movedOut,
  `staked ${movedIn}, distributed ${movedOut}`
);

// ---------------------------------------------------------------------------
console.log("\n6) the same listing cannot be adjudicated twice");
const dupe = await write(
  "file_claim",
  [modelId, settled.suspect_url],
  stake
);
check("duplicate URL rejected", !dupe.ok, "it was accepted");

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  FAILED: ${f}`));
  process.exitCode = 1;
} else {
  console.log("stake and bounty accounting verified end to end");
}
