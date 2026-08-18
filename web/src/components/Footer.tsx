import { useEffect, useRef } from "react";
import { gsap, useGsap, splitReveal, magnetic } from "../lib/motion";
import { CONTRACT_ADDRESS, CHAIN, EXPLORER } from "../lib/contract";

export default function Footer({ onEnter }: { onEnter: () => void }) {
  const cta = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cta.current) return magnetic(cta.current, 0.3);
  }, []);

  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);
    splitReveal(q(".f-head")[0], { trigger: self, start: "top 82%" });
    gsap.from(q(".f-meta"), {
      y: 22,
      opacity: 0,
      stagger: 0.07,
      scrollTrigger: { trigger: q(".f-meta")[0], start: "top 90%", once: true },
    });
  }, []);

  return (
    <footer ref={root} className="relative overflow-hidden bg-paper px-5 pb-10 pt-28 sm:px-8">
      <div className="mx-auto max-w-[1600px]">
        <h2 className="f-head display-xl">
          Register
          <br />
          <span className="accent-serif text-signal">your work.</span>
        </h2>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-ink/15 pt-8">
          <button ref={cta} onClick={onEnter} className="btn-primary">
            Open the console →
          </button>
          <a
            className="btn-ghost"
            href="https://docs.genlayer.com/"
            target="_blank"
            rel="noreferrer"
          >
            GenLayer docs
          </a>
        </div>

        <div className="mt-20 grid gap-8 border-t border-ink/15 pt-8 md:grid-cols-4">
          <div className="f-meta">
            <div className="eyebrow text-ink/40">Network</div>
            <div className="mt-2 font-mono text-[12px]">{CHAIN.name}</div>
            <div className="font-mono text-[11px] text-ink/45">
              chain id {String(CHAIN.id)}
            </div>
          </div>

          <div className="f-meta md:col-span-2">
            <div className="eyebrow text-ink/40">Contract</div>
            <a
              href={EXPLORER ? `${EXPLORER}/contracts/${CONTRACT_ADDRESS}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all font-mono text-[12px] underline decoration-ink/25 underline-offset-4 hover:decoration-signal"
            >
              {CONTRACT_ADDRESS}
            </a>
          </div>

          <div className="f-meta md:text-right">
            <div className="eyebrow text-ink/40">Status</div>
            <div className="mt-2 font-mono text-[12px] text-ink/60">
              Testnet demo · verdicts are evidence, not legal rulings
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4 border-t border-ink/15 pt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/35">
          <span>StealMyPrint · forensic layer for 3D-model IP</span>
          <span>Built on GenLayer Intelligent Contracts</span>
        </div>
      </div>
    </footer>
  );
}
