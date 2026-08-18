import { useState } from "react";
import { useWallet } from "../lib/wallet";
import { exportBurner, CHAIN } from "../lib/contract";

export default function WalletGate() {
  const { address, mode, connectBurner, connectInjected, connecting, error } =
    useWallet();
  const [revealed, setRevealed] = useState(false);

  if (address) {
    return (
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-paper/12 bg-coal p-5">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-verdict" />
          <div>
            <div className="font-mono text-[12px]">{address}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/40">
              {mode === "burner" ? "burner wallet" : "injected wallet"} ·{" "}
              {CHAIN.name}
            </div>
          </div>
        </div>

        {mode === "burner" && (
          <button
            onClick={() => setRevealed((v) => !v)}
            className="btn-ghost-inv !py-2 !text-[10px]"
          >
            {revealed ? "hide key" : "export key"}
          </button>
        )}

        {revealed && mode === "burner" && (
          <div className="w-full break-all rounded-lg border border-amber/40 bg-amber/10 p-3 font-mono text-[10.5px] text-amber">
            {exportBurner()}
            <div className="mt-1.5 opacity-70">
              Testnet key held in this browser's localStorage. Do not reuse it
              anywhere with real value.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-paper/12 bg-coal p-7">
      <div className="eyebrow text-paper/40">Connect to act</div>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-paper/60">
        Reading the registry is open to everyone. Registering a model or filing
        a claim needs a signer on {CHAIN.name}.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={connectBurner} className="btn-ghost-inv">
          Create a burner wallet
        </button>
        <button
          onClick={connectInjected}
          disabled={connecting}
          className="btn-ghost-inv !border-paper/15"
        >
          {connecting ? "connecting…" : "Connect wallet"}
        </button>
      </div>

      {error && (
        <div className="mt-4 font-mono text-[11px] text-signal">{error}</div>
      )}

      <p className="mt-5 font-mono text-[10.5px] leading-relaxed text-paper/35">
        A burner is generated in your browser and stored locally, the fastest way
        to try the flow. A browser wallet will be asked to switch to chain{" "}
        {String(CHAIN.id)}.
      </p>
    </div>
  );
}
