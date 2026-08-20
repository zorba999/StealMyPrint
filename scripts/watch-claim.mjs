import { readFileSync } from "fs";
import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const N = process.env.GENLAYER_NETWORK || "studionet";
const { address } = JSON.parse(readFileSync("deployments.json","utf8"))[N];
const c = createClient({ chain: chains[N] });
const read = (fn, a=[]) => c.readContract({ address, functionName: fn, args: a });
const target = process.argv[2];
for (let i = 0; i < 60; i++) {
  const claims = await read("get_claims");
  const hit = claims.find(x => x.suspect_url === target);
  if (hit) {
    console.log("SETTLED after", i*10, "s");
    console.log(JSON.stringify({
      id: hit.id, verdict: hit.verdict, confidence: hit.confidence,
      stake: hit.stake, payout: hit.payout, hunter: hit.hunter,
      identity: hit.identity, nature: hit.nature,
    }, null, 2));
    const m = await read("get_model", [hit.model_id]);
    console.log("model pool:", m.bounty_pool, "| per_hit:", m.bounty_per_hit);
    console.log("hunter:", JSON.stringify(await read("get_hunter", [hit.hunter])));
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 10000));
}
console.log("not settled within 600s");
