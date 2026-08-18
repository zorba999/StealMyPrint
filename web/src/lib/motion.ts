import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { useLayoutEffect, useRef, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

/** House easing — a long, weighted settle. Used everywhere for coherence. */
export const EASE = CustomEase.create("smp", "0.16, 1, 0.3, 1");
export const EASE_IN_OUT = CustomEase.create("smpIO", "0.76, 0, 0.24, 1");

gsap.defaults({ ease: EASE, duration: 1 });

// Dev-only handle so animations can be inspected/seeked without a rAF loop.
if (import.meta.env.DEV) (window as any).__GSAP__ = gsap;

/** Scoped GSAP context bound to a container ref. */
export function useGsap(
  setup: (ctx: { self: HTMLElement }) => void,
  deps: any[] = []
) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ctx = gsap.context(() => setup({ self: el }), el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Split a heading into lines+chars and fly them up behind a mask.
 * Returns the SplitText so callers can revert it.
 */
export function splitReveal(
  target: string | Element,
  opts: {
    trigger?: Element | string;
    start?: string;
    stagger?: number;
    delay?: number;
    duration?: number;
    y?: string;
    rotate?: number;
    scrub?: boolean;
  } = {}
) {
  const el =
    typeof target === "string"
      ? (document.querySelector(target) as HTMLElement)
      : (target as HTMLElement);
  if (!el) return null;

  // A previous split may still be in the DOM (fast refresh, remount).
  // Rebuild from the original text every time.
  if ((el as any)._smpSplit) {
    try {
      (el as any)._smpSplit.revert();
    } catch {
      /* node already gone */
    }
  }

  const split = new SplitText(el, {
    type: "lines,chars",
    linesClass: "reveal-mask",
  });
  (el as any)._smpSplit = split;

  gsap.set(split.chars, { yPercent: 118, rotate: opts.rotate ?? 3 });

  gsap.to(split.chars, {
    yPercent: 0,
    rotate: 0,
    duration: opts.duration ?? 1.05,
    stagger: opts.stagger ?? 0.014,
    delay: opts.delay ?? 0,
    ease: EASE,
    scrollTrigger: opts.trigger
      ? {
          trigger: opts.trigger,
          start: opts.start ?? "top 82%",
          once: true,
        }
      : undefined,
  });

  return split;
}

/** Fade + rise for blocks of content. */
export function riseIn(
  targets: gsap.TweenTarget,
  opts: { trigger?: Element | string; stagger?: number; y?: number; start?: string } = {}
) {
  return gsap.from(targets, {
    y: opts.y ?? 28,
    opacity: 0,
    duration: 0.95,
    stagger: opts.stagger ?? 0.07,
    ease: EASE,
    scrollTrigger: {
      trigger: (opts.trigger as any) ?? (targets as any),
      start: opts.start ?? "top 86%",
      once: true,
    },
  });
}

/** Seamless marquee. Duplicate your content twice inside the track. */
export function marquee(track: HTMLElement, speed = 42, direction = -1) {
  const half = track.scrollWidth / 2;
  gsap.set(track, { x: direction < 0 ? 0 : -half });
  return gsap.to(track, {
    x: direction < 0 ? -half : 0,
    duration: half / speed,
    ease: "none",
    repeat: -1,
  });
}

/** Cursor-following magnetism for buttons. */
export function magnetic(el: HTMLElement, strength = 0.32) {
  const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: EASE });
  const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: EASE });

  const move = (e: MouseEvent) => {
    const r = el.getBoundingClientRect();
    xTo((e.clientX - (r.left + r.width / 2)) * strength);
    yTo((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    xTo(0);
    yTo(0);
  };

  el.addEventListener("mousemove", move);
  el.addEventListener("mouseleave", reset);
  return () => {
    el.removeEventListener("mousemove", move);
    el.removeEventListener("mouseleave", reset);
  };
}

/** Animate a number up to its value when it scrolls into view. */
export function countTo(el: HTMLElement, value: number, suffix = "") {
  const obj = { v: 0 };
  return gsap.to(obj, {
    v: value,
    duration: 1.6,
    ease: EASE,
    onUpdate: () => {
      el.textContent = Math.round(obj.v).toLocaleString() + suffix;
    },
    scrollTrigger: { trigger: el, start: "top 90%", once: true },
  });
}

export { gsap, ScrollTrigger, SplitText };
