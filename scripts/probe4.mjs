import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: studionet, account });
const addr = process.argv[2];
const url = process.argv[3];
const t0 = Date.now();
const wtx = await client.writeContract({ address: addr, functionName: "run", args: [url], value: 0n });
const wr = await client.waitForTransactionReceipt({ hash: wtx, status: TransactionStatus.ACCEPTED, retries: 400 });
const lr = wr.consensus_data?.leader_receipt?.[0];
console.log("URL:", url, "| exec:", lr?.execution_result, "|", ((Date.now()-t0)/1000).toFixed(1)+"s");
if (lr?.execution_result !== "SUCCESS") {
  console.log("stderr:", (lr?.result?.stderr || lr?.stderr || "").slice(0,800));
  console.log("stdout:", (lr?.result?.stdout || lr?.stdout || "").slice(0,800));
  try {
    const tr = await client.debugTraceTransaction({ hash: wtx });
    console.log("TRACE:", JSON.stringify(tr).slice(0, 2500));
  } catch(e) { console.log("trace err", String(e).slice(0,300)); }
} else {
  console.log("RESULT:", await client.readContract({ address: addr, functionName: "get", args: [] }));
}
