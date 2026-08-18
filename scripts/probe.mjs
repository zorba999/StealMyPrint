import { readFileSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const account = createAccount(process.env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain: studionet, account });
console.log("Deployer:", account.address);

const code = new Uint8Array(readFileSync("scripts/probe.py"));
console.log("→ getContractSchemaForCode ...");
try {
  const schema = await client.getContractSchemaForCode(code);
  console.log("SCHEMA OK:", JSON.stringify(schema).slice(0, 400));
} catch (e) {
  console.log("SCHEMA ERR:", String(e).slice(0, 600));
}
