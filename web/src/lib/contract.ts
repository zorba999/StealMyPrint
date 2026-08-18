import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const NETWORK = (import.meta.env.VITE_GENLAYER_NETWORK ||
  "studionet") as keyof typeof chains;

export const CHAIN = chains[NETWORK] ?? chains.studionet;

/** Deployed StealMyPrint instance. Overridable per-environment. */
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x633Fc02B6c89290b6243eF8B0276750Cd800Eee1";

// The explorer named in the studionet chain config is not currently serving
// (genlayer-explorer.vercel.app answers 503), so linking there would hand the
// reader a dead end. Only expose a link for chains that actually have one.
export const EXPLORER = (CHAIN as any).isStudio
  ? ""
  : CHAIN.blockExplorers?.default?.url ?? "";

export const explorerContractUrl = (addr: string) =>
  EXPLORER ? `${EXPLORER}/contracts/${addr}` : "";

export type Verdict =
  | "CLEAR_VIOLATION"
  | "LIKELY"
  | "GRAY_ZONE"
  | "NO_VIOLATION"
  | "UNREADABLE";

export interface ModelRow {
  id: number;
  owner: string;
  title: string;
  canonical_url: string;
  license_tier: number;
  license_label: string;
  proof_code: string;
  verified: boolean;
  has_fingerprint: boolean;
  bounty_pool: string;
  bounty_per_hit: string;
  claims_filed: number;
  confirmed_thefts: number;
}

export interface ClaimRow {
  id: number;
  model_id: number;
  hunter: string;
  suspect_url: string;
  verdict: Verdict;
  identity: string;
  nature: string;
  attribution: string;
  confidence: number;
  reasoning: string;
  evidence_digest: string;
  stake: string;
  payout: string;
}

export interface Stats {
  models: number;
  claims: number;
  confirmed: number;
  min_stake: string;
}

/** genlayer-js decodes calldata maps into JS `Map`s, so flatten them to objects. */
function demap(value: any): any {
  if (value instanceof Map) {
    const out: Record<string, any> = {};
    for (const [k, v] of value.entries()) out[String(k)] = demap(v);
    return out;
  }
  if (Array.isArray(value)) return value.map(demap);
  if (typeof value === "bigint") return Number(value);
  return value;
}

export function readClient() {
  return createClient({ chain: CHAIN });
}

export async function read<T = any>(
  functionName: string,
  args: any[] = []
): Promise<T> {
  const client = readClient();
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args,
  });
  return demap(raw) as T;
}

export const getModels = () => read<ModelRow[]>("get_models");
export const getClaims = () => read<ClaimRow[]>("get_claims");
export const getStats = () => read<Stats>("get_stats");
export const getHunter = (addr: string) => read<any>("get_hunter", [addr]);
export const getSourceProbe = (url: string) =>
  read<string>("get_source_probe", [url]);

/** Burner key management: testnet convenience wallet held in localStorage. */
const BURNER_KEY = "smp.burner.pk";

export function loadBurner() {
  const pk = localStorage.getItem(BURNER_KEY);
  return pk ? createAccount(pk as `0x${string}`) : null;
}

export function createBurner() {
  const pk = generatePrivateKey();
  localStorage.setItem(BURNER_KEY, pk);
  return createAccount(pk);
}

export function clearBurner() {
  localStorage.removeItem(BURNER_KEY);
}

export function exportBurner() {
  return localStorage.getItem(BURNER_KEY);
}

export { TransactionStatus, createClient, createAccount };
