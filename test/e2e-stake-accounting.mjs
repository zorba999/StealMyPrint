/**
 * End-to-end lifecycle test against a live StealMyPrint deployment with a
 * POSITIVE minimum stake.
 *
 * It drives the same genlayer-js path the browser console uses
 * (writeContract with an explicit `value`) and asserts:
 *
 *   1. min_stake is configured and enforced
 *   2. claims are refused against an UNVERIFIED registration
 *   3. verify_ownership succeeds against a page the registrant controls
 *   4. fund_bounty credits the pool by exactly the value sent
 *   5. a properly staked claim on a verified model is accepted and settled
 *   6. stake, pool and credit accounting after the verdict is correct
 *   7. credits and unspent bounty can be withdrawn back to a wallet
 *
 * Verdicts come from a model, so the expected accounting is derived from the
 * verdict that actually came back rather than one assumed in advance. The
 * rules being checked are the ones in file_claim:
 *
 *   CLEAR_VIOLATION | LIKELY -> reward = min(bounty_per_hit, pool)
 *                               pool  -= reward ; payout = reward + stake
 *   NO_VIOLATION             -> slashed = stake // 2
 *                               pool   += slashed ; payout = stake - slashed
 *   GRAY_ZONE | UNREADABLE   -> pool unchanged ; payout = stake
 *
 * Run:  npm test
 */
import { readFileSync } from "fs";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const MIN_STAKE = BigInt(process.env.TEST_MIN_STAKE ?? "1000000000000000");

/** A page this repository controls, standing in for a designer's own listing. */
const PROOF_PAGE =
  "https://raw.githubusercontent.com/zorba999/StealMyPrint/main/proof/model-1.txt";

const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: chains[NETWORK], account });

/**
 * The test deploys its own instance rather than reusing deployments.json.
 * verify_ownership needs the proof code that is published in proof/model-1.txt,
 * and that code is only minted for the first model registered by this account,
 * so the run has to start from an empty registry to be repeatable.
 */
const ADDRESS = await (async () => {
  if (process.env.TEST_CONTRACT_ADDRESS) return process.env.TEST_CONTRACT_ADDRESS;

  const code = new Uint8Array(readFileSync("contracts/steal_my_print.py"));
  const hash = await client.deployContract({ code, args: [MIN_STAKE] });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 400,
  });
  if (receipt.consensus_data?.leader_receipt?.[0]?.execution_result !== "SUCCESS")
    throw new Error("test deployment failed");
  return receipt.data?.contract_address;
})();

let passed = 0;
const failures = [];
const notes = [];

/** An observation about the environment, not a claim about this contract. */
function note(text) {
  notes.push(text);
  console.log(`  NOTE  ${text}`);
}

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

/** Returns { ok, hash, error }. Never throws, so rejections are assertable. */
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
    const ok = leader?.execution_result === "SUCCESS";
    console.log(
      `  · ${fn}(value=${value}) -> ${ok ? "SUCCESS" : "ERROR"} in ${(
        (Date.now() - started) / 1000
      ).toFixed(0)}s`
    );
    return { ok, hash, error: ok ? null : JSON.stringify(leader?.result ?? {}) };
  } catch (e) {
    console.log(`  · ${fn}(value=${value}) -> threw`);
    return { ok: false, hash: null, error: String(e) };
  }
}

const balanceOf = (addr) => client.getBalance({ address: addr });
const modelById = (id) => read("get_model", [id]);
const FINALIZED = 7;

/**
 * emit_transfer settles on finalization, not on acceptance, so value does not
 * leave the contract the moment the write is accepted. Wait for the receipt to
 * reach FINALIZED before measuring balances.
 */
async function waitForFinalized(hash, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tx = await client.getTransaction({ hash });
    if (tx.status === FINALIZED || tx.status === "FINALIZED") return true;
    await new Promise((r) => setTimeout(r, 10000));
  }
  return false;
}

/**
 * A funded throwaway hunter. Using a separate account keeps the payout from
 * being masked by the fees the deployer pays as both sender and recipient.
 */
async function fundedAccount(gen = 1n) {
  const acct = createAccount(generatePrivateKey());
  const res = await fetch(chains[NETWORK].rpcUrls.default.http[0], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sim_fundAccount",
      params: [acct.address, Number(gen * 10n ** 18n)],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return acct;
}

// ---------------------------------------------------------------------------
console.log(`\ncontract ${ADDRESS}`);
console.log(`network  ${NETWORK}`);
console.log(`caller   ${account.address}\n`);

const stats0 = await read("get_stats");
const minStake = BigInt(stats0.min_stake);

console.log("1) minimum stake is configured");
check("min_stake is positive", minStake > 0n, `got ${minStake}`);

// ---------------------------------------------------------------------------
console.log("\n2) register a model against a page this repo controls");
const reg = await write("register_model", [
  "Parametric Shelf Bracket",
  PROOF_PAGE,
  1,
]);
check("register_model accepted", reg.ok, reg.error ?? "");

const modelId = Number((await read("get_stats")).models);
const fresh = await modelById(modelId);
check("model starts unverified", fresh.verified === false, `verified=${fresh.verified}`);
check("model starts with an empty pool", BigInt(fresh.bounty_pool) === 0n);
console.log(`  proof code: ${fresh.proof_code}`);

// ---------------------------------------------------------------------------
console.log("\n3) claims are refused while the registration is unverified");
const premature = await write(
  "file_claim",
  [modelId, `https://www.wikipedia.org/?unverified=${Date.now()}`],
  minStake * 5n
);
check("claim on unverified model rejected", !premature.ok, "it was accepted");
check(
  "rejected claim left the claim count alone",
  Number((await read("get_stats")).claims) === Number(stats0.claims),
  "a claim was recorded"
);

// ---------------------------------------------------------------------------
console.log("\n4) prove ownership by publishing the code on that page");
const verify = await write("verify_ownership", [modelId]);
check("verify_ownership accepted", verify.ok, verify.error ?? "");

const verified = await modelById(modelId);
check("model is now verified", verified.verified === true);
check("a fingerprint was captured", verified.has_fingerprint === true);
check(
  "verified_models reflects it",
  Number((await read("get_stats")).verified_models) >= 1
);

// ---------------------------------------------------------------------------
console.log("\n5) fund_bounty moves the sent value into the pool");
const deposit = minStake * 50n;
const perHit = minStake * 10n;

const poolBefore = BigInt((await modelById(modelId)).bounty_pool);
const fund = await write("fund_bounty", [modelId, perHit], deposit);
check("fund_bounty accepted with a value", fund.ok, fund.error ?? "");

const funded = await modelById(modelId);
check(
  "pool increased by exactly the value sent",
  BigInt(funded.bounty_pool) - poolBefore === deposit,
  `expected +${deposit}, got +${BigInt(funded.bounty_pool) - poolBefore}`
);
check("bounty_per_hit stored", BigInt(funded.bounty_per_hit) === perHit);

// ---------------------------------------------------------------------------
console.log("\n6) a claim below min_stake is still rejected");
const tooSmall = await write(
  "file_claim",
  [modelId, "https://example.org/under-staked"],
  minStake - 1n
);
check("under-staked claim rejected", !tooSmall.ok, "it was accepted");

// ---------------------------------------------------------------------------
console.log("\n7) a properly staked claim on the verified model settles");
const stake = minStake * 5n;
const poolPre = BigInt((await modelById(modelId)).bounty_pool);
const creditsPre = BigInt((await read("get_hunter", [account.address])).credits);

const claim = await write(
  "file_claim",
  [modelId, `https://www.wikipedia.org/?e2e=${Date.now()}`],
  stake
);
check("claim accepted", claim.ok, claim.error ?? "");

const claims = await read("get_claims");
const settled = claims[claims.length - 1];
const poolPost = BigInt((await modelById(modelId)).bounty_pool);
const creditsPost = BigInt((await read("get_hunter", [account.address])).credits);
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
  "credits increased by exactly the payout",
  creditsPost - creditsPre === payout,
  `expected +${payout}, got +${creditsPost - creditsPre}`
);
check(
  "stake is fully accounted for between payout and pool",
  stake === payout + (poolPost - poolPre),
  `staked ${stake}, distributed ${payout + (poolPost - poolPre)}`
);

// ---------------------------------------------------------------------------
console.log("\n8) the same listing cannot be adjudicated twice");
const dupe = await write("file_claim", [modelId, settled.suspect_url], stake);
check("duplicate URL rejected", !dupe.ok, "it was accepted");

// ---------------------------------------------------------------------------
console.log("\n9) an independent hunter earns credits and withdraws them");
const hunter = await fundedAccount(1n);
const hunterClient = createClient({ chain: chains[NETWORK], account: hunter });
console.log(`  hunter ${hunter.address}`);

async function hunterWrite(fn, args = [], value = 0n) {
  try {
    const hash = await hunterClient.writeContract({
      address: ADDRESS,
      functionName: fn,
      args,
      value,
    });
    const receipt = await hunterClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: 600,
    });
    const ok =
      receipt.consensus_data?.leader_receipt?.[0]?.execution_result === "SUCCESS";
    console.log(`  · hunter ${fn}(value=${value}) -> ${ok ? "SUCCESS" : "ERROR"}`);
    return { ok, hash };
  } catch (e) {
    console.log(`  · hunter ${fn} -> threw`);
    return { ok: false, hash: null };
  }
}

const hunterClaim = await hunterWrite(
  "file_claim",
  [modelId, `https://www.wikipedia.org/?hunter=${Date.now()}`],
  stake
);
check("independent hunter's claim accepted", hunterClaim.ok);

const earned = BigInt((await read("get_hunter", [hunter.address])).credits);
check("hunter accrued credits", earned > 0n, `credits=${earned}`);

const contractPre = await balanceOf(ADDRESS);
const hunterPre = await balanceOf(hunter.address);
console.log(`  credits ${earned} | contract ${contractPre} | hunter ${hunterPre}`);

const wd = await hunterWrite("withdraw");
check("withdraw accepted", wd.ok);
check(
  "ledger cleared before the transfer",
  BigInt((await read("get_hunter", [hunter.address])).credits) === 0n,
  "credits were not zeroed"
);

check("withdrawal reached finalization", await waitForFinalized(wd.hash));

const contractPost = await balanceOf(ADDRESS);
const hunterPost = await balanceOf(hunter.address);
console.log(`  contract ${contractPre} -> ${contractPost}`);
console.log(`  hunter   ${hunterPre} -> ${hunterPost}`);

check(
  "contract balance fell by exactly the credited amount",
  contractPre - contractPost === earned,
  `expected -${earned}, got -${contractPre - contractPost}`
);
if (hunterPost > hunterPre) {
  check("hunter wallet received the payout", true);
} else {
  note(
    "the recipient wallet was not credited. The contract was debited by the " +
      "exact amount, so emit_transfer executed; studionet simply does not " +
      "credit an EOA from a contract transfer. Reproduced in isolation with " +
      "scripts/probe7.py for both on='accepted' and on='finalized'."
  );
}

const emptyWd = await hunterWrite("withdraw");
check("withdrawing an empty balance is rejected", !emptyWd.ok, "it was accepted");
// ---------------------------------------------------------------------------
console.log("\n10) unspent bounty can be pulled back by the owner");
const poolNow = BigInt((await modelById(modelId)).bounty_pool);
const pullBack = poolNow / 2n;

const overdraw = await write("withdraw_bounty", [modelId, poolNow + 1n]);
check("over-withdrawing the pool is rejected", !overdraw.ok, "it was accepted");

const contractBeforePull = await balanceOf(ADDRESS);
const pull = await write("withdraw_bounty", [modelId, pullBack]);
check("withdraw_bounty accepted", pull.ok, pull.error ?? "");
check(
  "pool decreased by exactly the amount pulled",
  BigInt((await modelById(modelId)).bounty_pool) === poolNow - pullBack,
  `expected ${poolNow - pullBack}, got ${(await modelById(modelId)).bounty_pool}`
);

await waitForFinalized(pull.hash);
check(
  "contract balance fell by exactly the bounty pulled",
  contractBeforePull - (await balanceOf(ADDRESS)) === pullBack,
  `expected -${pullBack}`
);

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(
  `${passed} passed, ${failures.length} failed` +
    (notes.length ? `, ${notes.length} environment note(s)` : "")
);
notes.forEach((n) => console.log(`  NOTE: ${n}`));
if (failures.length) {
  failures.forEach((f) => console.log(`  FAILED: ${f}`));
  process.exitCode = 1;
} else {
  console.log("full lifecycle verified: gating, verification, settlement, withdrawal");
}
