import { gsap, useGsap, ScrollTrigger, splitReveal } from "../lib/motion";

const STEPS = [
  {
    n: "01",
    title: "Register",
    lede: "Claim the work without asking anyone for permission.",
    body: "You submit the model's title, its canonical page and a licence tier. The contract mints you a proof code, glp-4e00ed-1, which you paste into your own model description or profile bio.",
    tag: "register_model()",
  },
  {
    n: "02",
    title: "Prove",
    lede: "Ownership verified by the open web, not by an admin.",
    body: "The contract renders your canonical page and looks for that code. If it is there, you control the account, so you own the listing. It snapshots the page text at the same time, so later judgements survive the origin going offline.",
    tag: "verify_ownership()",
  },
  {
    n: "03",
    title: "Report",
    lede: "Anyone can hunt. Everyone has skin in the game.",
    body: "A hunter submits a suspect URL with a stake. The same URL cannot be adjudicated twice. A pre-flight probe tells them whether the page is even readable before they commit anything.",
    tag: "probe_source() → file_claim()",
  },
  {
    n: "04",
    title: "Adjudicate",
    lede: "Four questions, asked separately, on purpose.",
    body: "The leader renders the listing and asks: is it the same work, is a file or a print being sold, is the designer credited, and does that combination breach the registered licence. Validators re-run it and vote on equivalence.",
    tag: "gl.eq_principle.prompt_comparative",
  },
  {
    n: "05",
    title: "Settle",
    lede: "A verdict you can actually attach to a form.",
    body: "A confirmed hit pays the hunter from the bounty pool and records a signed evidence packet on-chain. A bad-faith report forfeits half the stake. An unreadable page punishes nobody.",
    tag: "CLEAR_VIOLATION · LIKELY · GRAY_ZONE · NO_VIOLATION",
  },
];

export default function HowItWorks() {
  const root = useGsap(({ self }) => {
    const q = gsap.utils.selector(self);
    const track = q(".track")[0] as HTMLElement;
    const panels = q(".panel");

    splitReveal(q(".how-head")[0], { trigger: self, start: "top 80%" });

    const mm = gsap.matchMedia();

    mm.add("(min-width: 900px)", () => {
      const distance = () => track.scrollWidth - window.innerWidth;

      const scroll = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: self,
          pin: true,
          scrub: 0.8,
          start: "top top",
          end: () => "+=" + distance(),
          invalidateOnRefresh: true,
        },
      });

      // progress rail
      gsap.to(q(".rail-fill"), {
        scaleX: 1,
        ease: "none",
        transformOrigin: "left",
        scrollTrigger: {
          trigger: self,
          scrub: 0.8,
          start: "top top",
          end: () => "+=" + distance(),
        },
      });

      // each panel lifts as it enters the viewport horizontally
      panels.forEach((p: any) => {
        gsap.from(p.querySelectorAll(".panel-inner > *"), {
          y: 34,
          opacity: 0,
          stagger: 0.06,
          duration: 0.8,
          scrollTrigger: {
            trigger: p,
            containerAnimation: scroll,
            start: "left 78%",
            once: true,
          },
        });
      });

      return () => scroll.kill();
    });

    mm.add("(max-width: 899px)", () => {
      panels.forEach((p: any) => {
        gsap.from(p.querySelectorAll(".panel-inner > *"), {
          y: 26,
          opacity: 0,
          stagger: 0.06,
          duration: 0.8,
          scrollTrigger: { trigger: p, start: "top 84%", once: true },
        });
      });
    });

    ScrollTrigger.refresh();
    return () => mm.revert();
  }, []);

  return (
    <section
      id="how"
      ref={root}
      className="relative overflow-hidden bg-ink text-paper"
    >
      <div className="mx-auto max-w-[1600px] px-5 pt-24 sm:px-8 md:pt-28">
        <div className="eyebrow text-paper/40">02 · The process</div>
        <h2 className="how-head display-lg mt-5 max-w-4xl">
          Five moves from{" "}
          <span className="accent-serif text-electric">upload</span> to evidence.
        </h2>
      </div>

      {/* progress rail */}
      <div className="mx-auto mt-10 max-w-[1600px] px-5 sm:px-8">
        <div className="h-px w-full bg-paper/15">
          <div className="rail-fill h-px w-full origin-left scale-x-0 bg-electric" />
        </div>
      </div>

      <div className="track flex flex-col gap-6 px-5 py-14 sm:px-8 md:flex-row md:gap-0 md:py-20">
        {STEPS.map((s, i) => (
          <article
            key={s.n}
            className={
              "panel shrink-0 md:w-[min(38vw,560px)] " +
              (i > 0 ? "md:pl-10" : "")
            }
          >
            <div className="panel-inner flex h-full flex-col rounded-2xl border border-paper/15 bg-coal p-7 sm:p-9">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-7xl font-medium leading-none tracking-tightest text-paper/15">
                  {s.n}
                </span>
                <span className="chip border-electric/40 text-electric">
                  step
                </span>
              </div>

              <h3 className="display-md mt-8">{s.title}</h3>

              <p className="mt-4 font-serif text-xl italic leading-snug text-paper/85">
                {s.lede}
              </p>

              <p className="mt-5 flex-1 text-[15px] leading-relaxed text-paper/55">
                {s.body}
              </p>

              <div className="mt-7 border-t border-paper/12 pt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-electric/80">
                {s.tag}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
