import { useState } from "react";
import { gsap, useGsap, splitReveal, riseIn } from "../lib/motion";

type Tone = "bad" | "warn" | "ok";

const TIERS = [
  { key: "PERSONAL_ONLY", label: "Personal only", hint: "No commercial use at all" },
  { key: "PRINTS_OK", label: "Prints OK", hint: "Sell prints, never the file" },
  { key: "COMMERCIAL_OK", label: "Commercial OK", hint: "Only credit can be breached" },
];

const NATURES = [
  { key: "DIGITAL_FILE", label: "Selling the file" },
  { key: "PHYSICAL_PRINT", label: "Selling a print" },
  { key: "BOTH", label: "Selling both" },
  { key: "UNCLEAR", label: "Listing unclear" },
];

const CELLS: Record<string, { verdict: string; tone: Tone; why: string }> = {
  "PERSONAL_ONLY|DIGITAL_FILE": {
    verdict: "CLEAR_VIOLATION",
    tone: "bad",
    why: "No commercial exploitation is permitted, and the file itself is being redistributed. This is the least ambiguous cell in the grid.",
  },
  "PERSONAL_ONLY|PHYSICAL_PRINT": {
    verdict: "CLEAR_VIOLATION",
    tone: "bad",
    why: "Under a personal-use licence, selling a printed copy is still commercial exploitation. This is the cell people get wrong most often.",
  },
  "PERSONAL_ONLY|BOTH": {
    verdict: "CLEAR_VIOLATION",
    tone: "bad",
    why: "Both halves of the listing breach the licence independently.",
  },
  "PERSONAL_ONLY|UNCLEAR": {
    verdict: "LIKELY",
    tone: "warn",
    why: "Any commercial listing breaches this tier, but the page does not describe what ships. Partial evidence, so the verdict is downgraded.",
  },
  "PRINTS_OK|DIGITAL_FILE": {
    verdict: "CLEAR_VIOLATION",
    tone: "bad",
    why: "The licence permits prints and forbids redistributing the file. The listing offers a download. This is the single most valuable judgement the system makes.",
  },
  "PRINTS_OK|PHYSICAL_PRINT": {
    verdict: "NO_VIOLATION",
    tone: "ok",
    why: "Entirely permitted. A naive keyword matcher would flag this and burn the designer's relationship with their own printing community.",
  },
  "PRINTS_OK|BOTH": {
    verdict: "CLEAR_VIOLATION",
    tone: "bad",
    why: "The physical half is fine; the digital half is not. One breach is enough.",
  },
  "PRINTS_OK|UNCLEAR": {
    verdict: "GRAY_ZONE",
    tone: "warn",
    why: "The permitted and forbidden readings are both plausible. The contract refuses to guess and flags it for a human.",
  },
  "COMMERCIAL_OK|DIGITAL_FILE": {
    verdict: "NO_VIOLATION",
    tone: "ok",
    why: "Commercial use is granted. Only a missing credit could be raised, and only as a minor breach.",
  },
  "COMMERCIAL_OK|PHYSICAL_PRINT": {
    verdict: "NO_VIOLATION",
    tone: "ok",
    why: "Fully permitted.",
  },
  "COMMERCIAL_OK|BOTH": {
    verdict: "NO_VIOLATION",
    tone: "ok",
    why: "Fully permitted.",
  },
  "COMMERCIAL_OK|UNCLEAR": {
    verdict: "NO_VIOLATION",
    tone: "ok",
    why: "Nothing in this tier depends on what is being shipped.",
  },
};

const TONE_CLASS: Record<Tone, string> = {
  bad: "bg-signal text-paper",
  warn: "bg-amber text-ink",
  ok: "bg-verdict text-paper",
};

export default function Matrix() {
  const [sel, setSel] = useState("PRINTS_OK|DIGITAL_FILE");
  const active = CELLS[sel];
  const [tier, nature] = sel.split("|");

  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);
    splitReveal(q(".m-head")[0], { trigger: self, start: "top 80%" });
    riseIn(q(".m-cell"), { trigger: q(".m-grid")[0], stagger: 0.025, y: 18 });
    riseIn(q(".m-side"), { trigger: q(".m-side")[0] });
  }, []);

  return (
    <section
      id="matrix"
      ref={root}
      className="relative bg-paper px-5 py-28 sm:px-8 md:py-40"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="eyebrow text-ink/40">03 · The judgement</div>
        <h2 className="m-head display-lg mt-5 max-w-4xl">
          The verdict is a <span className="accent-serif">matrix</span>,
          <br />
          not a boolean.
        </h2>

        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          {/* grid */}
          <div className="lg:col-span-8">
            <div className="m-grid overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[160px_repeat(4,1fr)] gap-px bg-ink/12">
                  <div className="bg-paper p-3" />
                  {NATURES.map((n) => (
                    <div
                      key={n.key}
                      className="bg-paper p-3 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-ink/55"
                    >
                      {n.label}
                    </div>
                  ))}

                  {TIERS.map((t) => (
                    <div key={t.key} className="contents">
                      <div className="bg-paper p-3">
                        <div className="font-display text-sm font-semibold uppercase tracking-tight">
                          {t.label}
                        </div>
                        <div className="mt-1 font-mono text-[10px] leading-tight text-ink/45">
                          {t.hint}
                        </div>
                      </div>

                      {NATURES.map((n) => {
                        const key = `${t.key}|${n.key}`;
                        const cell = CELLS[key];
                        const isSel = key === sel;
                        return (
                          <button
                            key={key}
                            onMouseEnter={() => setSel(key)}
                            onFocus={() => setSel(key)}
                            onClick={() => setSel(key)}
                            className={
                              "m-cell group relative flex min-h-[86px] flex-col justify-between p-3 text-left transition-all duration-200 " +
                              TONE_CLASS[cell.tone] +
                              (isSel
                                ? " ring-2 ring-inset ring-ink z-10"
                                : " opacity-[0.82] hover:opacity-100")
                            }
                          >
                            <span className="font-mono text-[9.5px] uppercase leading-tight tracking-[0.1em]">
                              {cell.verdict.replace("_", " ")}
                            </span>
                            <span className="self-end font-display text-2xl leading-none opacity-45 transition-opacity group-hover:opacity-90">
                              {cell.tone === "ok" ? "✓" : cell.tone === "bad" ? "✕" : "?"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-5 font-mono text-[11px] leading-relaxed text-ink/45">
              Hover any cell. Attribution is a third axis the contract also
              reports: it can turn a permitted listing into a minor breach
              without changing the cell.
            </p>
          </div>

          {/* explanation */}
          <aside className="m-side lg:col-span-4">
            <div className="sticky top-28 rounded-2xl border border-ink/15 p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip border-ink/25 text-ink/60">
                  {tier.replace("_", " ")}
                </span>
                <span className="text-ink/25">×</span>
                <span className="chip border-ink/25 text-ink/60">
                  {nature.replace("_", " ")}
                </span>
              </div>

              <div
                className={
                  "mt-6 inline-block rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] " +
                  TONE_CLASS[active.tone]
                }
              >
                {active.verdict.replace("_", " ")}
              </div>

              <p className="mt-6 text-[15px] leading-relaxed text-ink/75">
                {active.why}
              </p>

              <div className="mt-7 rule pt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/40">
                settled by prompt_comparative
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
