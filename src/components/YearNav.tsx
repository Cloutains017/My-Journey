"use client";

import { useEffect, useRef, useState } from "react";

interface YearNavProps {
  years: number[];
}

export default function YearNav({ years }: YearNavProps) {
  const [activeYear, setActiveYear] = useState<number | null>(years[0] ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingYearRef = useRef<number | null>(null);
  const scrollIdleRef = useRef<number | null>(null);
  const finishJumpRef = useRef<(() => void) | null>(null);
  const yearKey = years.join(",");

  useEffect(() => {
    const observedYears = yearKey ? yearKey.split(",").map(Number) : [];
    const nativeScrollEnd = "onscrollend" in window;
    function syncYear() {
      if (pendingYearRef.current !== null) return;
      const anchor = window.innerHeight * 0.3;
      const current = observedYears.find(year => {
        const bounds = document.getElementById(`year-${year}`)?.getBoundingClientRect();
        return bounds && bounds.bottom > anchor;
      });
      if (current !== undefined) setActiveYear(current);
    }

    function finishJump() {
      const target = pendingYearRef.current;
      if (target === null) return;
      pendingYearRef.current = null;
      scrollIdleRef.current = null;
      const section = target === null ? null : document.getElementById(`year-${target}`);
      const bounds = section?.getBoundingClientRect();
      const anchor = window.innerHeight * 0.3;
      const marginTop = section ? parseFloat(window.getComputedStyle(section).scrollMarginTop) || 0 : 0;
      const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
      // Keep short final years selected even when the page bottom prevents top alignment.
      // If the target never arrived, catch up after a scrollbar interruption too.
      const arrived = bounds && bounds.bottom > 0 &&
        ((bounds.top <= anchor && bounds.bottom > anchor) || Math.abs(bounds.top - marginTop) <= 2 ||
          (atBottom && bounds.top < window.innerHeight));
      if (!arrived) syncYear();
    }
    finishJumpRef.current = finishJump;

    function onScroll() {
      if (pendingYearRef.current === null || nativeScrollEnd) return;
      if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
      // Wait for scrolling to settle, rather than guessing the duration of a long jump.
      scrollIdleRef.current = window.setTimeout(finishJump, 200);
    }

    function interruptJump(event: Event) {
      if (event.type === "keydown" &&
        !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes((event as KeyboardEvent).key)) return;
      if (pendingYearRef.current === null) return;
      pendingYearRef.current = null;
      if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
      scrollIdleRef.current = null;
      syncYear();
    }

    const observer = new IntersectionObserver(
      syncYear,
      { rootMargin: "-30% 0px -69% 0px" },
    );

    for (const y of observedYears) {
      const el = document.getElementById(`year-${y}`);
      if (el) observer.observe(el);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", finishJump);
    window.addEventListener("wheel", interruptJump, { passive: true });
    window.addEventListener("touchstart", interruptJump, { passive: true });
    window.addEventListener("keydown", interruptJump);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", finishJump);
      window.removeEventListener("wheel", interruptJump);
      window.removeEventListener("touchstart", interruptJump);
      window.removeEventListener("keydown", interruptJump);
      if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
      scrollIdleRef.current = null;
      pendingYearRef.current = null;
      finishJumpRef.current = null;
    };
  }, [yearKey]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const button = list.querySelector<HTMLElement>(`[data-year="${activeYear}"]`);
    if (!button) return;
    function updateIndicator() {
      if (!list || !button) return;
      list.style.setProperty("--year-x", `${button.offsetLeft}px`);
      list.style.setProperty("--year-y", `${button.offsetTop}px`);
      list.style.setProperty("--year-width", `${button.offsetWidth}px`);
      list.style.setProperty("--year-height", `${button.offsetHeight}px`);
      list.dataset.ready = "true";
      if (window.matchMedia("(max-width: 1023px)").matches &&
        (button.offsetLeft < list.scrollLeft + 8 || button.offsetLeft + button.offsetWidth > list.scrollLeft + list.clientWidth - 8)) {
        list.scrollTo({ left: button.offsetLeft - (list.clientWidth - button.offsetWidth) / 2,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
    }
    updateIndicator();
    const resize = new ResizeObserver(updateIndicator);
    resize.observe(list);
    resize.observe(button);
    return () => resize.disconnect();
  }, [activeYear]);

  function scrollTo(year: number) {
    const section = document.getElementById(`year-${year}`);
    if (!section) return;
    pendingYearRef.current = year;
    setActiveYear(year);
    if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = null;
    const bounds = section.getBoundingClientRect();
    const marginTop = parseFloat(window.getComputedStyle(section).scrollMarginTop) || 0;
    const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
    const alreadyAtTarget = Math.abs(bounds.top - marginTop) <= 2 ||
      (atBottom && bounds.top >= marginTop && bounds.top < window.innerHeight);
    // Native completion survives pauses in long smooth scrolls. No-op clicks have no scrollend.
    if (!("onscrollend" in window) || alreadyAtTarget) {
      scrollIdleRef.current = window.setTimeout(() => finishJumpRef.current?.(), alreadyAtTarget ? 0 : 200);
    }
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }

  if (years.length <= 1) return null;

  return (
    <nav className="year-nav" aria-label="按年份浏览旅程">
      <p className="year-nav-label">沿着年份</p>
      <div className="year-nav-list" ref={listRef}>
        <span className="year-nav-indicator" aria-hidden="true" />
        {years.map((year) => (
          <button
            type="button"
            key={year}
            data-year={year}
            onClick={() => scrollTo(year)}
            aria-current={activeYear === year ? "date" : undefined}
            className="year-nav-link"
          >
            {year}
          </button>
        ))}
      </div>
    </nav>
  );
}
