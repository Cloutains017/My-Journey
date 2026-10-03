"use client";

import { useEffect, useRef, useState } from "react";

interface YearNavProps {
  years: number[];
}

export default function YearNav({ years }: YearNavProps) {
  const [activeYear, setActiveYear] = useState<number | null>(years[0] ?? null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      () => {
        const anchor = window.innerHeight * 0.3;
        const current = years.find(year => {
          const bounds = document.getElementById(`year-${year}`)?.getBoundingClientRect();
          return bounds && bounds.bottom > anchor;
        });
        if (current !== undefined) setActiveYear(current);
      },
      { rootMargin: "-30% 0px -69% 0px" },
    );

    for (const y of years) {
      const el = document.getElementById(`year-${y}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [years]);

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
    document.getElementById(`year-${year}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
    setActiveYear(year);
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
