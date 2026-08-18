import { useEffect, useRef, useState } from "react";
import { gsap, EASE } from "../lib/motion";
import { useWallet } from "../lib/wallet";

export default function Nav({
  onNavigate,
  route,
}: {
  onNavigate: (to: string) => void;
  route: string;
}) {
  const bar = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(false);
  const { address, mode, disconnect } = useWallet();

  useEffect(() => {
    gsap.from(bar.current, { y: -70, opacity: 0, duration: 1, delay: 0.9, ease: EASE });
    const onScroll = () => setSolid(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={bar}
      className={
        "fixed inset-x-0 top-0 z-50 transition-all duration-300 " +
        (solid
          ? "border-b border-ink/10 bg-paper/85 backdrop-blur-xl"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <button
          onClick={() => onNavigate("/")}
          className="group flex items-center gap-2.5"
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-[6px] bg-ink transition-transform duration-300 group-hover:rotate-45" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-[15px] font-semibold uppercase tracking-tighter">
            StealMyPrint
          </span>
        </button>

        <nav className="hidden items-center gap-7 md:flex">
          {[
            ["Problem", "#problem"],
            ["Process", "#how"],
            ["Matrix", "#matrix"],
            ["Sources", "#sources"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={route === "/" ? href : "/" + href}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60 transition-colors hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {address && (
            <button
              onClick={disconnect}
              title="Disconnect"
              className="chip border-ink/20 text-ink/70 hover:border-signal hover:text-signal"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-verdict" />
              {address.slice(0, 6)}…{address.slice(-4)}
              <span className="opacity-50">· {mode}</span>
            </button>
          )}
          <button
            onClick={() => onNavigate(route === "/console" ? "/" : "/console")}
            className="btn-primary !px-5 !py-2.5"
          >
            {route === "/console" ? "← Back" : "Console"}
          </button>
        </div>
      </div>
    </header>
  );
}
