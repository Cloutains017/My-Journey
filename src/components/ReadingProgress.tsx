"use client";

import { useEffect, useRef, useState } from "react";

export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const article = document.getElementById("trip-reading");
    if (!article) return;
    let frame: number | null = null;

    function update() {
      frame = null;
      const { top, height } = article!.getBoundingClientRect();
      const distance = height - (window.innerHeight - 64);
      const progress = distance > 0 ? Math.min(1, Math.max(0, (64 - top) / distance)) : top <= 64 ? 1 : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      setShowTop(previous => {
        const next = window.scrollY > Math.max(400, window.innerHeight * .75);
        return previous === next ? previous : next;
      });
    }

    function schedule() {
      if (frame === null) frame = window.requestAnimationFrame(update);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(article);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={barRef} className="reading-progress" aria-hidden="true" style={{ transform: "scaleX(0)" }} />
      {showTop && <button type="button" className="back-to-top" aria-label="返回顶部" onClick={() => {
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        document.getElementById("trip-top")?.focus({ preventScroll: true });
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v12" /></svg>
        <span>顶部</span>
      </button>}
    </>
  );
}
