import { useEffect, useRef } from "react";
import { gsap, useGsap, splitReveal, magnetic, EASE } from "../lib/motion";

export default function Hero({ onEnter }: { onEnter: () => void }) {
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ctaRef.current) return magnetic(ctaRef.current, 0.28);
  }, []);

  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);

    const tl = gsap.timeline({ delay: 0.15 });

    // curtain lift
    tl.to(q(".hero-curtain"), {
      scaleY: 0,
      duration: 1.1,
      ease: EASE,
      transformOrigin: "top",
    });

    // headline, line by line
    splitReveal(q(".hero-l1")[0], { delay: 0.35, stagger: 0.018 });
    splitReveal(q(".hero-l2")[0], { delay: 0.5, stagger: 0.018 });
    splitReveal(q(".hero-l3")[0], { delay: 0.65, stagger: 0.018 });

    tl.from(
      q(".hero-meta"),
      { y: 22, opacity: 0, stagger: 0.09, duration: 0.9 },
      0.9
    );

    // the forensic beam sweeping the headline block
    gsap.fromTo(
      q(".scanbeam"),
      { top: "0%", opacity: 0 },
      {
        top: "100%",
        opacity: 1,
        duration: 2.6,
        ease: "none",
        repeat: -1,
        repeatDelay: 1.4,
        delay: 1.2,
      }
    );

    // parallax drift on scroll
    gsap.to(q(".hero-headline"), {
      yPercent: -14,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: {
        trigger: self,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      },
    });

    // subtle counter-drift on the receipt card
    gsap.to(q(".hero-receipt"), {
      yPercent: -34,
      ease: "none",
      scrollTrigger: {
        trigger: self,
        start: "top top",
        end: "bottom top",
        scrub: 0.9,
      },
    });
  }, []);

  return (
    <section
      ref={root}
      className="relative min-h-[100svh] overflow-hidden bg-paper pt-28"
    >
      <div className="hero-curtain pointer-events-none absolute inset-0 z-40 bg-ink" />

      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        {/* headline */}
        <div className="hero-headline relative">
          <div className="scanbeam" style={{ top: 0 }} />

          <h1 className="display-xl">
            <span className="hero-l1 block">They sold</span>
            <span className="hero-l2 block">
              your model <span className="accent-serif text-signal">back</span>
            </span>
            <span className="hero-l3 block">to you.</span>
          </h1>
        </div>

        {/* meta row */}
        <div className="mt-12 grid gap-8 border-t border-ink/15 pt-7 md:grid-cols-12">
          <p className="hero-meta md:col-span-5 max-w-md text-[15px] leading-relaxed text-ink/70">
            Most 3D-model licences let anyone sell a{" "}
            <span className="accent-serif">printed copy</span> — and forbid
            reselling the <span className="accent-serif">file</span>. One
            sentence in a listing separates the two. That sentence is the whole
            job, and no ordinary contract can read it.
          </p>

          <div className="hero-meta md:col-span-3">
            <div className="eyebrow text-ink/45">Time to a verdict</div>
            <div className="mt-2 font-display text-5xl font-medium tracking-tighter">
              ~90<span className="text-2xl align-top">s</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink/50">
              versus 1–6 weeks for a DMCA form
            </div>
          </div>

          <div className="hero-meta md:col-span-4 flex md:justify-end">
            <div className="flex flex-col gap-3">
              <button
                ref={ctaRef}
                onClick={onEnter}
                className="btn-primary w-fit"
              >
                Open the console →
              </button>
              <a href="#how" className="btn-ghost w-fit">
                How adjudication works
              </a>
            </div>
          </div>
        </div>

        {/* live receipt sample */}
        <div className="hero-receipt mt-16 pb-24">
          <div className="card-dark relative overflow-hidden rounded-2xl p-6 text-paper sm:p-8">
            <div className="hatch-inv absolute inset-0 opacity-60" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="eyebrow text-paper/45">
                  Specimen verdict · signed by validator consensus
                </div>
                <div className="chip border-signal/60 bg-signal/10 text-signal">
                  Clear violation
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-4">
                {[
                  ["Q1 identity", "SAME", "electric"],
                  ["Q2 nature", "DIGITAL_FILE", "signal"],
                  ["Q3 attribution", "ABSENT", "signal"],
                  ["Confidence", "92", "paper"],
                ].map(([k, v, tone]) => (
                  <div key={k as string}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">
                      {k}
                    </div>
                    <div
                      className={
                        "mt-1.5 font-display text-xl tracking-tight " +
                        (tone === "electric"
                          ? "text-electric"
                          : tone === "signal"
                          ? "text-signal"
                          : "text-paper")
                      }
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 max-w-2xl border-t border-paper/12 pt-5 font-mono text-[12px] leading-relaxed text-paper/60">
                “The listing offers an instant digital download of an STL
                matching the registered work, with no credit to the original
                designer. The registered licence permits selling printed copies
                only.”
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
