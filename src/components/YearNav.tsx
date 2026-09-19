"use client";

import { useEffect, useState } from "react";

interface YearNavProps {
  years: number[];
}

export default function YearNav({ years }: YearNavProps) {
  const [activeYear, setActiveYear] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const y = Number(entry.target.id.replace("year-", ""));
            if (!isNaN(y)) setActiveYear(y);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    for (const y of years) {
      const el = document.getElementById(`year-${y}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [years]);

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
      <div className="year-nav-list">
        {years.map((year) => (
          <button
            type="button"
            key={year}
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
