import { gsap, useGsap, splitReveal, riseIn, countTo } from "../lib/motion";

const STATS: [string, number, string, string][] = [
  ["Weeks a DMCA takedown takes", 6, "", "Manual review, counter-notice, repeat"],
  ["Hours to open a replacement shop", 48, "h", "The asymmetry that kills designers"],
  ["Cost to the thief", 0, "", "One upload. No risk. No cost."],
];

export default function Problem() {
  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);

    splitReveal(q(".p-head")[0], { trigger: self, start: "top 78%" });
    riseIn(q(".p-body"), { trigger: q(".p-body")[0], stagger: 0.1 });

    q(".stat-num").forEach((el: any) => {
      countTo(el, Number(el.dataset.value), el.dataset.suffix || "");
    });

    // the three columns slide apart slightly as you scroll past
    gsap.to(q(".drift-a"), {
      yPercent: -8,
      ease: "none",
      scrollTrigger: { trigger: self, start: "top bottom", end: "bottom top", scrub: 1 },
    });
    gsap.to(q(".drift-b"), {
      yPercent: 6,
      ease: "none",
      scrollTrigger: { trigger: self, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  }, []);

  return (
    <section
      id="problem"
      ref={root}
      className="relative bg-paper px-5 py-28 sm:px-8 md:py-40"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="eyebrow text-ink/40">01 — The asymmetry</div>

        <h2 className="p-head display-lg mt-6 max-w-5xl">
          Stealing costs nothing.
          <br />
          <span className="accent-serif">Defending</span> costs your evening.
        </h2>

        <div className="mt-16 grid gap-x-10 gap-y-14 md:grid-cols-12">
          <div className="p-body drift-a md:col-span-5">
            <p className="text-[17px] leading-relaxed text-ink/75">
              A designer publishes an STL. Someone downloads it, opens a shop,
              and lists it as an{" "}
              <span className="accent-serif">instant download</span>. The
              designer has to find it themselves, fill a form, prove ownership,
              wait weeks — and watch the shop reappear under a new name.
            </p>
            <p className="mt-5 text-[17px] leading-relaxed text-ink/75">
              Meanwhile the honest printer selling a{" "}
              <span className="accent-serif">physical copy</span> of the same
              model is usually doing nothing wrong at all. Punish them and you
              lose your community.
            </p>
          </div>

          <div className="p-body drift-b md:col-span-6 md:col-start-7">
            <div className="grid gap-px overflow-hidden rounded-xl bg-ink/12">
              {STATS.map(([label, value, suffix, note]) => (
                <div key={label} className="bg-paper p-6 sm:p-7">
                  <div className="flex items-end justify-between gap-6">
                    <div className="eyebrow max-w-[16rem] text-ink/50">
                      {label}
                    </div>
                    <div
                      className="stat-num font-display text-6xl font-medium leading-none tracking-tightest"
                      data-value={value}
                      data-suffix={suffix}
                    >
                      0
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-ink/45">
                    {note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-body mt-20 rule pt-8">
          <p className="max-w-3xl font-display text-2xl leading-snug tracking-tight sm:text-3xl">
            So the real question is never “is this theft?”. It is{" "}
            <span className="accent-serif text-signal">
              which of these two things
            </span>{" "}
            is being sold — and that is a reading task, not a hashing task.
          </p>
        </div>
      </div>
    </section>
  );
}
