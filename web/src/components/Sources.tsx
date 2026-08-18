import { gsap, useGsap, splitReveal, riseIn } from "../lib/motion";

type State = "ok" | "flaky" | "blocked";

const SOURCES: { host: string; state: State; note: string; mode: string }[] = [
  { host: "gumroad.com", state: "flaky", mode: "html", note: "Returns 117k chars of markup but 0 in text mode, and stripping leaves no prose. Adjudicated as unreadable." },
  { host: "openscad.org", state: "ok", mode: "text", note: "1.1k chars. Server-rendered pages read cleanly." },
  { host: "wikipedia.org", state: "ok", mode: "text", note: "2k chars. Produced a NO_VIOLATION verdict at confidence 95." },
  { host: "instructables.com", state: "flaky", mode: "html", note: "Returns 0 chars as text; needs the html pass." },
  { host: "cults3d.com", state: "flaky", mode: "text", note: "Served 2.9k chars, then 403'd once probed repeatedly. Retried twice per claim." },
  { host: "myminifactory.com", state: "flaky", mode: "text", note: "Responds with a body but a non-200 status on unknown paths." },
  { host: "printables.com", state: "blocked", mode: "—", note: "HTTP 403 to the renderer." },
  { host: "thingiverse.com", state: "blocked", mode: "—", note: "HTTP 403 to the renderer." },
  { host: "makerworld.com", state: "blocked", mode: "—", note: "HTTP 403 to the renderer." },
  { host: "etsy.com", state: "blocked", mode: "—", note: "HTTP 403 to the renderer." },
];

const STATE_META: Record<State, { label: string; cls: string; dot: string }> = {
  ok: { label: "Readable", cls: "text-verdict", dot: "bg-verdict" },
  flaky: { label: "Intermittent", cls: "text-amber", dot: "bg-amber" },
  blocked: { label: "Bot-gated", cls: "text-signal", dot: "bg-signal" },
};

export default function Sources() {
  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);
    splitReveal(q(".s-head")[0], { trigger: self, start: "top 80%" });
    riseIn(q(".s-row"), { trigger: q(".s-table")[0], stagger: 0.035, y: 16 });
    riseIn(q(".s-note"), { trigger: q(".s-note")[0] });
  }, []);

  return (
    <section
      id="sources"
      ref={root}
      className="relative bg-ink px-5 py-28 text-paper sm:px-8 md:py-40"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="eyebrow text-paper/40">04 — What actually works</div>
        <h2 className="s-head display-lg mt-5 max-w-4xl">
          Half the internet
          <br />
          <span className="accent-serif text-signal">won't let us look.</span>
        </h2>

        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <div className="s-note lg:col-span-4">
            <p className="text-[16px] leading-relaxed text-paper/70">
              These are measured results, not a wishlist. Every row was probed
              from a live contract on the GenLayer Studio network.
            </p>
            <p className="mt-5 text-[16px] leading-relaxed text-paper/55">
              Large marketplaces return <span className="font-mono text-signal">403</span>{" "}
              to the validator renderer. So the contract does not guess — it
              returns <span className="font-mono text-electric">UNREADABLE</span>,
              refunds the stake and punishes nobody. The console runs a
              pre-flight probe so a hunter finds out before they commit.
            </p>
            <p className="mt-5 text-[16px] leading-relaxed text-paper/55">
              Honest coverage today is roughly{" "}
              <span className="text-paper">70–85% recall</span> on reachable
              sources. Seventy percent in ninety seconds still beats one hundred
              percent in six weeks.
            </p>
          </div>

          <div className="s-table lg:col-span-8">
            <div className="border-t border-paper/15">
              {SOURCES.map((s) => {
                const m = STATE_META[s.state];
                return (
                  <div
                    key={s.host}
                    className="s-row grid grid-cols-[1fr_auto] items-start gap-4 border-b border-paper/12 py-4 transition-colors hover:bg-paper/[0.03] sm:grid-cols-[220px_110px_1fr]"
                  >
                    <div className="flex items-center gap-2.5 font-mono text-[13px]">
                      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + m.dot} />
                      {s.host}
                    </div>

                    <div
                      className={
                        "font-mono text-[10px] uppercase tracking-[0.14em] " + m.cls
                      }
                    >
                      {m.label}
                      <span className="ml-2 text-paper/25">{s.mode}</span>
                    </div>

                    <div className="col-span-2 text-[13px] leading-relaxed text-paper/45 sm:col-span-1">
                      {s.note}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
