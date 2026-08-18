import { readFileSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: studionet, account });
let addr = process.env.PROBE5_ADDR;
if (!addr) {
  const code = new Uint8Array(readFileSync("scripts/probe5.py"));
  const tx = await client.deployContract({ code, args: [] });
  const r = await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.ACCEPTED, retries: 300 });
  addr = r.data?.contract_address;
  console.log("PROBE5_ADDR=" + addr);
}
for (const [url, mode] of JSON.parse(process.argv[2])) {
  try {
    const wtx = await client.writeContract({ address: addr, functionName: "probe", args: [url, mode], value: 0n });
    const wr = await client.waitForTransactionReceipt({ hash: wtx, status: TransactionStatus.ACCEPTED, retries: 400 });
    const ex = wr.consensus_data?.leader_receipt?.[0]?.execution_result;
    const out = ex === "SUCCESS" ? await client.readContract({ address: addr, functionName: "get", args: [] }) : "(tx ERROR)";
    console.log(`[${mode}] ${url}\n   → ${String(out).slice(0, 300)}\n`);
  } catch (e) { console.log(`[${mode}] ${url}\n   → THROW ${String(e).slice(0,200)}\n`); }
}
