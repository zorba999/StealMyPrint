import { useEffect, useRef } from "react";
import { gsap } from "../lib/motion";
import type { TxStep } from "../lib/wallet";

export default function TxRail({ steps }: { steps: TxStep[] }) {
  const beam = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!beam.current) return;
    const tw = gsap.fromTo(
      beam.current,
      { xPercent: -100 },
      { xPercent: 100, duration: 1.5, ease: "none", repeat: -1 }
    );
    return () => {
      tw.kill();
    };
  }, []);

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-electric/30 bg-coal">
      <div className="relative h-0.5 overflow-hidden bg-paper/10">
        <div
          ref={beam}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-electric to-transparent"
        />
      </div>

      <div className="p-6">
        <div className="eyebrow text-electric">Consensus in progress</div>
        <ol className="mt-5 space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span
                className={
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full " +
                  (s.state === "done"
                    ? "bg-verdict"
                    : s.state === "running"
                    ? "animate-pulse bg-electric"
                    : s.state === "failed"
                    ? "bg-signal"
                    : "bg-paper/20")
                }
              />
              <div className="min-w-0">
                <div
                  className={
                    "font-mono text-[12px] " +
                    (s.state === "pending" ? "text-paper/35" : "text-paper/80")
                  }
                >
                  {s.label}
                </div>
                {s.detail && (
                  <div className="mt-1 break-all font-mono text-[10.5px] text-paper/35">
                    {s.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t border-paper/10 pt-4 font-mono text-[10.5px] text-paper/35">
          Web rendering plus model inference across validators: 60 to 240
          seconds is normal. Keep this tab open.
        </p>
      </div>
    </div>
  );
}
