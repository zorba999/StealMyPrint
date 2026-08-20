/**
 * Deploy StealMyPrint to the configured GenLayer network.
 *
 * The deploy key lives in .env.local and never leaves this process — it is not
 * bundled into the frontend.
 *
 *   node deploy/deploy.mjs            # deploy fresh
 *   node deploy/deploy.mjs --schema   # validate only, no transaction
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createClient, createAccount } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONTRACT_PATH = "contracts/steal_my_print.py";
const NETWORK = process.env.GENLAYER_NETWORK || "studionet";
// Wei, so it must stay a BigInt: Number() would silently lose precision on
// anything above ~9e15.
const MIN_STAKE = process.env.GENLAYER_MIN_STAKE ?? "0";

const chain = chains[NETWORK];
if (!chain) {
  throw new Error(
    `Unknown network "${NETWORK}". Available: ${Object.keys(chains).join(", ")}`
  );
}

const pk = process.env.GENLAYER_PRIVATE_KEY;
if (!pk) throw new Error("GENLAYER_PRIVATE_KEY missing from .env.local");

const account = createAccount(pk);
const client = createClient({ chain, account });
const code = new Uint8Array(readFileSync(CONTRACT_PATH));

console.log(`network   ${chain.name} (${chain.id})`);
console.log(`rpc       ${chain.rpcUrls.default.http[0]}`);
console.log(`deployer  ${account.address}`);

const schema = await client.getContractSchemaForCode(code);
const methods = Object.keys(schema.methods);
console.log(`schema    OK — ${methods.length} methods`);

if (process.argv.includes("--schema")) {
  console.log(methods.map((m) => `  · ${m}`).join("\n"));
  process.exit(0);
}

const balance = await client.getBalance({ address: account.address });
console.log(`balance   ${balance} wei`);
if (balance === 0n) {
  throw new Error("Deployer has no balance — fund it before deploying.");
}

console.log(`\ndeploying ${CONTRACT_PATH} (min_stake=${MIN_STAKE}) ...`);
const txHash = await client.deployContract({
  code,
  args: [BigInt(MIN_STAKE)],
});
console.log(`tx        ${txHash}`);

const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  status: TransactionStatus.ACCEPTED,
  retries: 400,
});

const execResult = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
if (execResult !== "SUCCESS") {
  console.error(JSON.stringify(receipt, null, 2).slice(0, 3000));
  throw new Error(`Deployment failed: ${execResult}`);
}

const address = receipt.data?.contract_address;
console.log(`\n✔ deployed`);
console.log(`address   ${address}`);

// record it, and push it into the web app's env so the UI picks it up
const record = existsSync("deployments.json")
  ? JSON.parse(readFileSync("deployments.json", "utf8"))
  : {};
record[NETWORK] = { address, txHash, deployedAt: new Date().toISOString() };
writeFileSync("deployments.json", JSON.stringify(record, null, 2));

writeFileSync(
  "web/.env.local",
  `VITE_CONTRACT_ADDRESS=${address}\nVITE_GENLAYER_NETWORK=${NETWORK}\n`
);
console.log(`written   deployments.json + web/.env.local`);
