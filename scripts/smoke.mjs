/** End-to-end smoke test against the deployed contract. */
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

console.log("contract", address, "\n");

async function write(fn, args, value = 0n) {
  const t0 = Date.now();
  const hash = await client.writeContract({ address, functionName: fn, args, value });
  const r = await client.waitForTransactionReceipt({
    hash, status: TransactionStatus.ACCEPTED, retries: 500,
  });
  const lr = r.consensus_data?.leader_receipt?.[0];
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const votes = r.consensus_data?.validators?.map((v) => v.vote).join(",") ?? "-";
  if (lr?.execution_result === "SUCCESS") {
    console.log(`  ✔ ${fn}(${args.join(", ").slice(0, 70)}) — ${secs}s  votes[${votes}]`);
    return true;
  }
  const err = lr?.result?.stderr || JSON.stringify(lr?.result ?? {}).slice(0, 260);
  console.log(`  ✖ ${fn} — ${secs}s — ${String(err).slice(0, 260)}`);
  return false;
}

const read = (fn, args = []) =>
  client.readContract({ address, functionName: fn, args });

console.log("1) register models");
await write("register_model", ["Bubble Wrap Vase", "https://cults3d.com/en/3d-model/home/bubble-wrap-vase", 1]);
await write("register_model", ["Low Poly Dragon Bust", "https://cults3d.com/en/3d-model/art/scrooge-mc-duck-peaky-blinders-urban-vibes-fan-art-stl-figure", 0]);

console.log("\n2) ownership verification against a page we do NOT control (must fail cleanly)");
await write("verify_ownership", [1]);

console.log("\n3) adjudicate listings");
await write("file_claim", [1, "https://discover.gumroad.com/"]);
await write("file_claim", [1, "https://cults3d.com/en/3d-model/home/flower-vase-017-stl-for-3d-printing"]);
await write("file_claim", [2, "https://www.thingiverse.com/thing:763622"]);

console.log("\n4) state");
console.log("stats  ", JSON.stringify(await read("get_stats")));
const models = await read("get_models");
for (const m of models) {
  console.log(`model #${m.id} "${m.title}" [${m.license_label}] proof=${m.proof_code} verified=${m.verified} claims=${m.claims_filed} thefts=${m.confirmed_thefts}`);
}
const claims = await read("get_claims");
for (const c of claims) {
  console.log(`\nclaim #${c.id} → ${c.verdict}  conf=${c.confidence}`);
  console.log(`   url        ${c.suspect_url}`);
  console.log(`   identity=${c.identity} nature=${c.nature} attribution=${c.attribution}`);
  console.log(`   evidence   ${c.evidence_digest}`);
  console.log(`   reasoning  ${String(c.reasoning).slice(0, 260)}`);
}
console.log("\nhunter", JSON.stringify(await read("get_hunter", [account.address])));
