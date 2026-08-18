import { readFileSync } from "fs";
import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
const { address } = JSON.parse(readFileSync("deployments.json","utf8"))[NETWORK];
const client = createClient({ chain: chains[NETWORK] });
const read = (fn, args=[]) => client.readContract({ address, functionName: fn, args });
console.log("stats", JSON.stringify(await read("get_stats")));
for (const u of ["https://gumroad.com/discover?query=stl","https://www.printables.com/model/4266-benchy"]) {
  const p = await read("get_source_probe",[u]);
  console.log("\nprobe", u, "\n  ", p ? String(p).slice(0,230) : "(none)");
}
const claims = await read("get_claims");
for (const c of claims) console.log(`\ncase #${c.id} ${c.verdict} conf=${c.confidence} nature=${c.nature}\n   ${String(c.suspect_url).slice(0,60)}\n   ${String(c.reasoning).slice(0,190)}`);
