import { useEffect, useRef } from "react";
import { marquee } from "../lib/motion";

const ITEMS = [
  "STL BUNDLES · 500 FILES · $14.99",
  "INSTANT DIGITAL DOWNLOAD",
  "NO CREDIT GIVEN",
  "CC-BY-NC BREACHED",
  "RE-UPLOADED IN 48H",
  "SHOP CLOSED · SHOP REOPENED",
  "COUNTER-NOTICE FILED",
  "DESIGNER GAVE UP",
];

export default function Ticker({ invert = false }: { invert?: boolean }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!track.current) return;
    const tw = marquee(track.current, 58, invert ? 1 : -1);
    return () => {
      tw.kill();
    };
  }, [invert]);

  const row = [...ITEMS, ...ITEMS];

  return (
    <div
      className={
        "relative overflow-hidden border-y py-3.5 " +
        (invert
          ? "border-paper/15 bg-ink text-paper"
          : "border-ink/15 bg-signal text-paper")
      }
    >
      <div ref={track} className="marquee-track">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-6 whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.2em]"
          >
            {t}
            <span className="opacity-45">✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}
