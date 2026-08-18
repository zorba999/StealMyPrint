import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import {
  CHAIN,
  CONTRACT_ADDRESS,
  NETWORK,
  createBurner,
  clearBurner,
  loadBurner,
} from "./contract";

type Mode = "burner" | "injected" | null;

export interface TxStep {
  label: string;
  state: "pending" | "running" | "done" | "failed";
  detail?: string;
}

interface WalletCtx {
  address: string | null;
  mode: Mode;
  connecting: boolean;
  error: string | null;
  connectBurner: () => void;
  connectInjected: () => Promise<void>;
  disconnect: () => void;
  send: (fn: string, args: any[], value?: bigint) => Promise<any>;
  steps: TxStep[];
  busy: boolean;
}

const Ctx = createContext<WalletCtx>(null as any);
export const useWallet = () => useContext(Ctx);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [busy, setBusy] = useState(false);

  // restore a burner from a previous visit
  useEffect(() => {
    const existing = loadBurner();
    if (existing) {
      setAccount(existing);
      setAddress(existing.address);
      setMode("burner");
    }
  }, []);

  const connectBurner = useCallback(() => {
    setError(null);
    const acct = loadBurner() ?? createBurner();
    setAccount(acct);
    setAddress(acct.address);
    setMode("burner");
  }, []);

  const connectInjected = useCallback(async () => {
    setError(null);
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No injected wallet found. Install MetaMask or use a burner.");
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned");

      // ask the wallet to move to the GenLayer chain; genlayer-js handles
      // wallet_addEthereumChain for us
      try {
        const c = createClient({ chain: CHAIN, account: addr as `0x${string}`, provider: eth });
        await c.connect(NETWORK as any);
      } catch {
        /* user may already be on it, or declined the switch — keep going */
      }

      setAccount(addr);
      setAddress(addr);
      setMode("injected");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (mode === "burner") clearBurner();
    setAccount(null);
    setAddress(null);
    setMode(null);
  }, [mode]);

  const send = useCallback(
    async (fn: string, args: any[], value: bigint = 0n) => {
      if (!account) throw new Error("Connect a wallet first");
      setBusy(true);
      setSteps([
        { label: "Signing transaction", state: "running" },
        { label: "Leader executes · fetches the page · asks the model", state: "pending" },
        { label: "Validators vote on equivalence", state: "pending" },
      ]);

      const patch = (i: number, s: TxStep["state"], detail?: string) =>
        setSteps((prev) =>
          prev.map((step, idx) => (idx === i ? { ...step, state: s, detail } : step))
        );

      try {
        const client =
          mode === "injected"
            ? createClient({
                chain: CHAIN,
                account: account as `0x${string}`,
                provider: (window as any).ethereum,
              })
            : createClient({ chain: CHAIN, account });

        const hash = await client.writeContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: fn,
          args,
          value,
        });
        patch(0, "done", hash);
        patch(1, "running");

        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.ACCEPTED,
          retries: 600,
        });

        const leader = (receipt as any).consensus_data?.leader_receipt?.[0];
        const votes: string[] =
          (receipt as any).consensus_data?.validators?.map((v: any) => v.vote) ?? [];

        patch(1, "done");
        patch(
          2,
          "done",
          votes.length ? votes.join(" · ") : "consensus reached"
        );

        if (leader?.execution_result !== "SUCCESS") {
          const detail =
            leader?.result?.stderr ||
            (typeof leader?.result === "object"
              ? JSON.stringify(leader.result)
              : String(leader?.result ?? ""));
          throw new Error(cleanError(detail));
        }
        return { hash, receipt, votes };
      } catch (e: any) {
        setSteps((prev) =>
          prev.map((s) => (s.state === "running" ? { ...s, state: "failed" } : s))
        );
        throw new Error(cleanError(e?.shortMessage || e?.message || String(e)));
      } finally {
        setBusy(false);
      }
    },
    [account, mode]
  );

  const value = useMemo(
    () => ({
      address,
      mode,
      connecting,
      error,
      connectBurner,
      connectInjected,
      disconnect,
      send,
      steps,
      busy,
    }),
    [address, mode, connecting, error, connectBurner, connectInjected, disconnect, send, steps, busy]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Contract `raise Exception("…")` arrives wrapped in VM noise — dig it out. */
function cleanError(raw: string) {
  if (!raw) return "Transaction failed";
  const m = raw.match(/Exception:?\s*([^"'\\}]{6,300})/);
  if (m) return m[1].trim();
  if (raw.includes("exit_code 1"))
    return "The contract rejected this call (a require/raise failed).";
  return raw.slice(0, 300);
}
