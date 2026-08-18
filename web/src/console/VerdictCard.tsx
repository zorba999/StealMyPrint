import { useEffect, useRef, useState } from "react";
import { gsap, EASE } from "../lib/motion";
import type { ClaimRow, ModelRow, Verdict } from "../lib/contract";

const TONE: Record<Verdict, { cls: string; ring: string; label: string }> = {
  CLEAR_VIOLATION: {
    cls: "bg-signal text-paper",
    ring: "border-signal/45",
    label: "Clear violation",
  },
  LIKELY: { cls: "bg-amber text-ink", ring: "border-amber/45", label: "Likely" },
  GRAY_ZONE: {
    cls: "bg-paper/15 text-paper",
    ring: "border-paper/20",
    label: "Gray zone",
  },
  NO_VIOLATION: {
    cls: "bg-verdict text-paper",
    ring: "border-verdict/45",
    label: "No violation",
  },
  UNREADABLE: {
    cls: "bg-paper/10 text-paper/70",
    ring: "border-paper/15",
    label: "Unreadable",
  },
};

export default function VerdictCard({
  claim,
  model,
}: {
  claim: ClaimRow;
  model?: ModelRow;
}) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  const tone = TONE[claim.verdict] ?? TONE.GRAY_ZONE;

  useEffect(() => {
    gsap.from(card.current, {
      y: 20,
      opacity: 0,
      duration: 0.7,
      ease: EASE,
      scrollTrigger: { trigger: card.current, start: "top 92%", once: true },
    });
  }, []);

  useEffect(() => {
    if (!body.current) return;
    gsap.to(body.current, {
      height: open ? "auto" : 0,
      opacity: open ? 1 : 0,
      duration: 0.45,
      ease: EASE,
    });
  }, [open]);

  return (
    <div
      ref={card}
      className={"rounded-2xl border bg-coal " + tone.ring}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-5 p-6 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/35">
              case #{claim.id}
            </span>
            {model && (
              <span className="font-mono text-[10px] text-paper/35">
                vs “{model.title}” [{model.license_label.replace("_", " ")}]
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={
                "rounded-full px-3.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] " +
                tone.cls
              }
            >
              {tone.label}
            </span>
            <span className="font-mono text-[11px] text-paper/45">
              confidence {claim.confidence}
            </span>
          </div>

          <div className="mt-3 truncate font-mono text-[11px] text-paper/45">
            {claim.suspect_url}
          </div>
        </div>

        <span className="mt-1 shrink-0 font-mono text-[11px] text-paper/35">
          {open ? "−" : "+"}
        </span>
      </button>

      <div ref={body} className="h-0 overflow-hidden opacity-0">
        <div className="border-t border-paper/10 p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              ["Q1 identity", claim.identity],
              ["Q2 nature", claim.nature],
              ["Q3 attribution", claim.attribution],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="eyebrow text-paper/35">{k}</div>
                <div className="mt-1.5 font-display text-lg tracking-tight">
                  {String(v).replace("_", " ")}
                </div>
              </div>
            ))}
          </div>

          {claim.evidence_digest && (
            <div className="mt-6">
              <div className="eyebrow text-paper/35">Evidence digest</div>
              <div className="mt-1.5 break-words font-mono text-[11.5px] text-paper/60">
                {claim.evidence_digest}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="eyebrow text-paper/35">Reasoning</div>
            <p className="mt-2 text-[14px] leading-relaxed text-paper/70">
              {claim.reasoning}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-paper/10 pt-5">
            <span className="chip border-paper/15 text-paper/45">
              hunter {claim.hunter.slice(0, 8)}…
            </span>
            <span className="chip border-paper/15 text-paper/45">
              stake {claim.stake}
            </span>
            <span className="chip border-paper/15 text-paper/45">
              payout {claim.payout}
            </span>
            <a
              href={claim.suspect_url}
              target="_blank"
              rel="noreferrer"
              className="chip border-paper/15 text-paper/45 hover:border-electric hover:text-electric"
            >
              open listing ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
