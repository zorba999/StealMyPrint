/**
 * Seed the deployed registry with a verified, funded model plus one
 * adjudicated case, so the console is not empty on a fresh deployment.
 *
 * The model points at proof/model-1.txt in this repository, which carries the
 * proof code the contract mints for model #1 of the deploying account. That is
 * what lets verify_ownership succeed, and claims are only adjudicated against
 * verified registrations.
 */
import { readFileSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const { address } = JSON.parse(readFileSync("deployments.json", "utf8"))[NETWORK];
const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: chains[NETWORK], account });

const PROOF_PAGE =
  "https://raw.githubusercontent.com/zorba999/StealMyPrint/main/proof/model-1.txt";

console.log("seeding", address);

async function write(fn, args, value = 0n) {
  const t0 = Date.now();
  try {
    const hash = await client.writeContract({
      address, functionName: fn, args, value,
    });
    const r = await client.waitForTransactionReceipt({
      hash, status: TransactionStatus.ACCEPTED, retries: 600,
    });
    const lr = r.consensus_data?.leader_receipt?.[0];
    const ok = lr?.execution_result === "SUCCESS";
    console.log(
      `${ok ? "OK  " : "ERR "} ${fn} ${((Date.now() - t0) / 1000).toFixed(0)}s` +
        (ok ? "" : ` :: ${JSON.stringify(lr?.result ?? {}).slice(0, 160)}`)
    );
    return ok;
  } catch (e) {
    console.log(`ERR  ${fn} :: ${String(e).slice(0, 140)}`);
    return false;
  }
}

const read = (fn, args = []) =>
  client.readContract({ address, functionName: fn, args });

await write("register_model", ["Parametric Shelf Bracket", PROOF_PAGE, 1]);
await write("verify_ownership", [1]);
await write("fund_bounty", [1, 10000000000000000n], 50000000000000000n);
await write("probe_source", ["https://www.printables.com/model/4266-benchy"]);
await write("file_claim", [1, "https://www.wikipedia.org/"], 5000000000000000n);

console.log("\nstats  ", JSON.stringify(await read("get_stats")));
const m = await read("get_model", [1]);
console.log(`model #1 "${m.title}" verified=${m.verified} pool=${m.bounty_pool}`);
for (const c of await read("get_claims")) {
  console.log(`case #${c.id} ${c.verdict} conf=${c.confidence} stake=${c.stake} payout=${c.payout}`);
}
