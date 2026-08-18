import { readFileSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: studionet, account });
console.log("Deployer:", account.address);

try { const b = await client.getBalance({ address: account.address }); console.log("Balance:", b?.toString()); } catch(e){ console.log("bal err", String(e).slice(0,120)); }
try { const f = await client.fundAccount({ address: account.address }); console.log("Funded:", JSON.stringify(f).slice(0,200)); } catch(e){ console.log("fund err:", String(e).slice(0,200)); }

await client.initializeConsensusSmartContract();
const code = new Uint8Array(readFileSync("scripts/probe.py"));
const tx = await client.deployContract({ code, args: [] });
console.log("deploy tx:", tx);
const receipt = await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.ACCEPTED, retries: 300 });
const addr = receipt.data?.contract_address;
console.log("Contract:", addr, "| exec:", receipt.consensus_data?.leader_receipt?.[0]?.execution_result);

const report = await client.readContract({ address: addr, functionName: "api_report", args: [] });
console.log("\n===== AVAILABLE API =====\n" + report.split(" | ").join("\n"));
