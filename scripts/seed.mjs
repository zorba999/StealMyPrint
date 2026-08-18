/** Seed the deployed registry with demo models, probes and claims. */
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

console.log("seeding", address);

async function write(fn, args) {
  const t0 = Date.now();
  try {
    const hash = await client.writeContract({
      address, functionName: fn, args, value: 0n,
    });
    const r = await client.waitForTransactionReceipt({
      hash, status: TransactionStatus.ACCEPTED, retries: 600,
    });
    const lr = r.consensus_data?.leader_receipt?.[0];
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(
      `${lr?.execution_result === "SUCCESS" ? "✔" : "✖"} ${fn}(${String(args[0]).slice(0, 44)}…) ${s}s`
    );
  } catch (e) {
    console.log(`✖ ${fn} — ${String(e).slice(0, 140)}`);
  }
}

// --- registry ---------------------------------------------------------------
await write("register_model", [
  "Bubble Wrap Vase",
  "https://cults3d.com/en/3d-model/home/bubble-wrap-vase",
  1,
]);
await write("register_model", [
  "Articulated Slink Dragon",
  "https://www.printables.com/model/4266-benchy",
  0,
]);
await write("register_model", [
  "Parametric Shelf Bracket",
  "https://openscad.org/",
  2,
]);

// --- pre-flight probes ------------------------------------------------------
await write("probe_source", ["https://gumroad.com/discover?query=stl"]);
await write("probe_source", ["https://www.printables.com/model/4266-benchy"]);

// --- adjudications ----------------------------------------------------------
await write("file_claim", [3, "https://openscad.org/"]);
await write("file_claim", [1, "https://www.wikipedia.org/"]);
await write("file_claim", [1, "https://gumroad.com/discover?query=stl"]);
await write("file_claim", [2, "https://www.thingiverse.com/thing:763622"]);

// --- report -----------------------------------------------------------------
const read = (fn, args = []) =>
  client.readContract({ address, functionName: fn, args });

console.log("\nstats", JSON.stringify(await read("get_stats")));
for (const c of await read("get_claims")) {
  console.log(
    `case #${c.id} ${c.verdict} conf=${c.confidence} | ${String(c.suspect_url).slice(0, 52)}`
  );
  console.log(`   ${String(c.reasoning).slice(0, 170)}`);
}
