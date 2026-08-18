import { useCallback, useEffect, useState } from "react";
import { gsap, useGsap, riseIn } from "../lib/motion";
import { useWallet } from "../lib/wallet";
import {
  CHAIN,
  CONTRACT_ADDRESS,
  EXPLORER,
  getClaims,
  getModels,
  getStats,
  getSourceProbe,
  exportBurner,
  type ClaimRow,
  type ModelRow,
  type Stats,
} from "../lib/contract";
import WalletGate from "./WalletGate";
import TxRail from "./TxRail";
import VerdictCard from "./VerdictCard";

type Tab = "registry" | "register" | "investigate" | "cases";

const TABS: [Tab, string][] = [
  ["registry", "Registry"],
  ["register", "Register a model"],
  ["investigate", "Investigate a listing"],
  ["cases", "Case feed"],
];

export default function Console() {
  const { address, send, busy, steps } = useWallet();
  const [tab, setTab] = useState<Tab>("registry");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, c, s] = await Promise.all([getModels(), getClaims(), getStats()]);
      setModels(m ?? []);
      setClaims((c ?? []).slice().reverse());
      setStats(s);
    } catch (e: any) {
      setErr("Could not read the contract: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn: string, args: any[], okMsg: string) => {
    setErr(null);
    setOk(null);
    try {
      await send(fn, args);
      setOk(okMsg);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);
    gsap.from(q(".c-head > *"), { y: 24, opacity: 0, stagger: 0.06, duration: 0.8 });
    riseIn(q(".c-stat"), { trigger: q(".c-stats")[0], stagger: 0.06, y: 16 });
  }, []);

  return (
    <div ref={root} className="min-h-screen bg-ink pb-28 pt-28 text-paper">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8">
        {/* header */}
        <div className="c-head">
          <div className="eyebrow text-paper/40">Console · {CHAIN.name}</div>
          <h1 className="display-lg mt-4">
            Forensic <span className="accent-serif text-electric">desk</span>
          </h1>
          <a
            href={EXPLORER ? `${EXPLORER}/contracts/${CONTRACT_ADDRESS}` : "#"}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block break-all font-mono text-[11px] text-paper/45 underline decoration-paper/20 underline-offset-4 hover:text-electric"
          >
            {CONTRACT_ADDRESS}
          </a>
        </div>

        <WalletGate />

        {/* stats */}
        <div className="c-stats mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-paper/12 md:grid-cols-4">
          {[
            ["Models registered", stats?.models ?? 0],
            ["Claims adjudicated", stats?.claims ?? 0],
            ["Confirmed breaches", stats?.confirmed ?? 0],
            ["Min stake (wei)", stats?.min_stake ?? "0"],
          ].map(([label, value]) => (
            <div key={label as string} className="c-stat bg-coal p-5">
              <div className="eyebrow text-paper/40">{label}</div>
              <div className="mt-2 font-display text-4xl font-medium tracking-tightest">
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="mt-10 flex flex-wrap gap-2 border-b border-paper/12 pb-4">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                "rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors " +
                (tab === key
                  ? "bg-paper text-ink"
                  : "border border-paper/20 text-paper/60 hover:border-paper/50 hover:text-paper")
              }
            >
              {label}
            </button>
          ))}
          <button
            onClick={refresh}
            className="ml-auto rounded-full border border-paper/20 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-paper/50 hover:text-electric"
          >
            Refresh
          </button>
        </div>

        {busy && <TxRail steps={steps} />}

        {err && (
          <div className="mt-6 rounded-xl border border-signal/50 bg-signal/10 p-4 font-mono text-[12px] leading-relaxed text-signal">
            {err}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-xl border border-verdict/50 bg-verdict/10 p-4 font-mono text-[12px] text-verdict">
            {ok}
          </div>
        )}

        <div className="mt-8">
          {loading && (
            <div className="font-mono text-[12px] text-paper/40">
              Reading contract state…
            </div>
          )}

          {!loading && tab === "registry" && (
            <Registry
              models={models}
              address={address}
              onVerify={(id) =>
                run(
                  "verify_ownership",
                  [id],
                  `Model #${id} verified. Fingerprint captured.`
                )
              }
              disabled={busy || !address}
            />
          )}

          {!loading && tab === "register" && (
            <RegisterForm
              disabled={busy || !address}
              onSubmit={(t, u, tier) =>
                run(
                  "register_model",
                  [t, u, tier],
                  "Model registered. Open the Registry tab for your proof code."
                )
              }
            />
          )}

          {!loading && tab === "investigate" && (
            <Investigate
              models={models}
              disabled={busy || !address}
              onProbe={(url) => run("probe_source", [url], "Probe complete.")}
              onFile={(id, url) =>
                run("file_claim", [id, url], "Claim adjudicated. See the Case feed.")
              }
            />
          )}

          {!loading && tab === "cases" && <Cases claims={claims} models={models} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ registry */
function Registry({
  models,
  address,
  onVerify,
  disabled,
}: {
  models: ModelRow[];
  address: string | null;
  onVerify: (id: number) => void;
  disabled: boolean;
}) {
  if (!models.length)
    return (
      <Empty
        title="No models registered yet"
        body="Use the Register tab to add the first one."
      />
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {models.map((m) => {
        const mine = address && m.owner.toLowerCase() === address.toLowerCase();
        return (
          <div key={m.id} className="rounded-2xl border border-paper/15 bg-coal p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/35">
                  model #{m.id}
                </div>
                <h3 className="mt-1.5 font-display text-2xl tracking-tight">
                  {m.title}
                </h3>
              </div>
              <span
                className={
                  "chip shrink-0 " +
                  (m.verified
                    ? "border-verdict/50 text-verdict"
                    : "border-amber/50 text-amber")
                }
              >
                {m.verified ? "verified" : "unverified"}
              </span>
            </div>

            <a
              href={m.canonical_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block truncate font-mono text-[11px] text-paper/45 underline decoration-paper/15 underline-offset-4 hover:text-electric"
            >
              {m.canonical_url}
            </a>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip border-paper/20 text-paper/60">
                {m.license_label.replace("_", " ")}
              </span>
              <span className="chip border-paper/20 text-paper/60">
                {m.claims_filed} claims
              </span>
              <span
                className={
                  "chip " +
                  (m.confirmed_thefts > 0
                    ? "border-signal/50 text-signal"
                    : "border-paper/20 text-paper/60")
                }
              >
                {m.confirmed_thefts} confirmed
              </span>
            </div>

            {mine && !m.verified && (
              <div className="mt-6 rounded-xl border border-paper/12 bg-ink/60 p-4">
                <div className="eyebrow text-paper/40">Your proof code</div>
                <div className="mt-2 font-mono text-lg text-electric">
                  {m.proof_code}
                </div>
                <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-paper/45">
                  Paste this into the model description or your profile bio on
                  the canonical page, then verify.
                </p>
                <button
                  disabled={disabled}
                  onClick={() => onVerify(m.id)}
                  className="btn-ghost-inv mt-4 !py-2 !text-[10px]"
                >
                  Verify ownership
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ register */
function RegisterForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (title: string, url: string, tier: number) => void;
  disabled: boolean;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tier, setTier] = useState(1);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form
        className="lg:col-span-7"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(title.trim(), url.trim(), tier);
        }}
      >
        <label className="eyebrow text-paper/40">Model title</label>
        <input
          className="field-inv mt-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bubble Wrap Vase"
          required
        />

        <label className="eyebrow mt-6 block text-paper/40">
          Canonical page (the one you control)
        </label>
        <input
          className="field-inv mt-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://cults3d.com/en/3d-model/..."
          required
        />

        <label className="eyebrow mt-6 block text-paper/40">Licence tier</label>
        <div className="mt-3 grid gap-2">
          {[
            [0, "Personal only", "No commercial use of any kind"],
            [1, "Prints OK", "Sell printed copies, never the file"],
            [2, "Commercial OK", "Only attribution can be breached"],
          ].map(([v, label, hint]) => (
            <button
              type="button"
              key={String(v)}
              onClick={() => setTier(Number(v))}
              className={
                "flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-colors " +
                (tier === Number(v)
                  ? "border-electric bg-electric/10"
                  : "border-paper/15 hover:border-paper/35")
              }
            >
              <span>
                <span className="font-display text-lg tracking-tight">
                  {label}
                </span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-paper/45">
                  {hint}
                </span>
              </span>
              <span
                className={
                  "h-3 w-3 rounded-full border " +
                  (tier === Number(v)
                    ? "border-electric bg-electric"
                    : "border-paper/30")
                }
              />
            </button>
          ))}
        </div>

        <button disabled={disabled} className="btn-ghost-inv mt-8">
          Register model
        </button>
      </form>

      <aside className="lg:col-span-5">
        <div className="rounded-2xl border border-paper/12 bg-coal p-6">
          <div className="eyebrow text-paper/40">What happens next</div>
          <ol className="mt-4 space-y-4 text-[13.5px] leading-relaxed text-paper/60">
            <li>
              <span className="text-electric">1.</span> The contract stores your
              model and mints a unique proof code.
            </li>
            <li>
              <span className="text-electric">2.</span> You paste that code into
              your own page, proving control without any KYC.
            </li>
            <li>
              <span className="text-electric">3.</span> Verification renders the
              page, finds the code, and snapshots the text as a fingerprint for
              later comparisons.
            </li>
          </ol>
          <p className="mt-6 border-t border-paper/12 pt-4 font-mono text-[10.5px] leading-relaxed text-paper/40">
            Unverified models can still be investigated: the contract falls
            back to the title as its reference.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* --------------------------------------------------------------- investigate */
function Investigate({
  models,
  onProbe,
  onFile,
  disabled,
}: {
  models: ModelRow[];
  onProbe: (url: string) => void;
  onFile: (id: number, url: string) => void;
  disabled: boolean;
}) {
  const [modelId, setModelId] = useState<number>(models[0]?.id ?? 1);
  const [url, setUrl] = useState("");
  const [probe, setProbe] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const readProbe = async () => {
    if (!url.trim()) return;
    setChecking(true);
    try {
      const raw = await getSourceProbe(url.trim());
      setProbe(raw ? JSON.parse(raw) : null);
    } catch {
      setProbe(null);
    } finally {
      setChecking(false);
    }
  };

  if (!models.length)
    return <Empty title="Nothing to investigate" body="Register a model first." />;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <label className="eyebrow text-paper/40">Registered work</label>
        <select
          className="field-inv mt-2 bg-coal"
          value={modelId}
          onChange={(e) => setModelId(Number(e.target.value))}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.id} · {m.title} [{m.license_label}]
            </option>
          ))}
        </select>

        <label className="eyebrow mt-6 block text-paper/40">Suspect listing URL</label>
        <input
          className="field-inv mt-2"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setProbe(null);
          }}
          placeholder="https://…"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={disabled || !url.trim()}
            onClick={() => onProbe(url.trim())}
            className="btn-ghost-inv"
          >
            1 · Pre-flight probe
          </button>
          <button
            onClick={readProbe}
            disabled={!url.trim() || checking}
            className="btn-ghost-inv !border-paper/15"
          >
            {checking ? "reading…" : "read probe result"}
          </button>
          <button
            disabled={disabled || !url.trim()}
            onClick={() => onFile(modelId, url.trim())}
            className="btn !bg-signal !text-paper hover:!bg-paper hover:!text-ink"
          >
            2 · File claim
          </button>
        </div>

        {probe && (
          <div
            className={
              "mt-6 rounded-xl border p-5 " +
              (probe.readable
                ? "border-verdict/40 bg-verdict/10"
                : "border-signal/40 bg-signal/10")
            }
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (probe.readable ? "bg-verdict" : "bg-signal")
                }
              />
              {probe.readable
                ? `readable · ${probe.chars} chars`
                : "unreadable by the validator renderer"}
            </div>
            <p className="mt-3 break-words font-mono text-[11px] leading-relaxed text-paper/50">
              {String(probe.note).slice(0, 220)}
            </p>
          </div>
        )}
      </div>

      <aside className="lg:col-span-5">
        <div className="rounded-2xl border border-paper/12 bg-coal p-6">
          <div className="eyebrow text-paper/40">Why probe first</div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-paper/60">
            Large marketplaces return 403 to the validator renderer. Filing a
            claim against an unreadable page costs compute and returns{" "}
            <span className="font-mono text-electric">UNREADABLE</span>. The
            probe tells you in advance, and its result is cached on-chain for
            everyone else.
          </p>
          <p className="mt-5 border-t border-paper/12 pt-4 font-mono text-[10.5px] leading-relaxed text-paper/40">
            Adjudication takes 60–240s. The leader fetches the page and reasons
            over it; validators re-run it and vote on equivalence.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* --------------------------------------------------------------------- cases */
function Cases({ claims, models }: { claims: ClaimRow[]; models: ModelRow[] }) {
  if (!claims.length)
    return (
      <Empty
        title="No cases yet"
        body="File a claim from the Investigate tab to populate the feed."
      />
    );

  return (
    <div className="grid gap-4">
      {claims.map((c) => (
        <VerdictCard
          key={c.id}
          claim={c}
          model={models.find((m) => m.id === c.model_id)}
        />
      ))}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-paper/20 p-14 text-center">
      <div className="font-display text-2xl tracking-tight text-paper/70">
        {title}
      </div>
      <div className="mt-2 font-mono text-[12px] text-paper/40">{body}</div>
    </div>
  );
}

export { exportBurner };
