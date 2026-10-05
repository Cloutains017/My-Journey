"use client";

import { useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import YearNav from "@/components/YearNav";
import { RATING_LABELS } from "@/lib/types";
import { filterJourneys, readJourneyFilters, type JourneySearchRecord } from "@/lib/journey-browsing";

export interface JourneyItem extends JourneySearchRecord { content: ReactNode }

export default function JourneyExplorer({ items }: { items: JourneyItem[] }) {
  const params = useSearchParams();
  const filters = readJourneyFilters(params);
  const [query, setQuery] = useState(filters.query);
  const [urlQuery, setUrlQuery] = useState(filters.query);
  const [isComposing, setIsComposing] = useState(false);
  const composing = useRef(false);
  // Restore browser history without making the URL the input's live value.
  if (urlQuery !== filters.query) {
    setUrlQuery(filters.query);
    const currentQuery = typeof window === "undefined" ? filters.query : readJourneyFilters(new URLSearchParams(window.location.search)).query;
    if (!isComposing && filters.query === currentQuery) setQuery(filters.query);
  }
  const filtered = filterJourneys(items, filters);
  const groups = new Map<number, JourneyItem[]>();
  for (const item of filtered) {
    const year = Number(item.date.slice(0, 4));
    const group = groups.get(year) ?? [];
    group.push(item);
    groups.set(year, group);
  }
  const years = [...groups.keys()].sort((a, b) => b - a);
  const tripCount = filtered.filter(item => item.kind === "trip").length;
  const schoolCount = filtered.length - tripCount;
  const active = Boolean(filters.query || filters.rating);

  function update(name: "q" | "rating", value: string) {
    const next = new URLSearchParams(window.location.search);
    next.delete("year");
    if (value) next.set(name, value); else next.delete(name);
    if (next.toString() === new URLSearchParams(window.location.search).toString()) return;
    const url = `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`;
    if (name === "q") window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  function reset() {
    composing.current = false;
    setIsComposing(false);
    setQuery("");
    const next = new URLSearchParams(window.location.search);
    ["q", "year", "rating"].forEach(name => next.delete(name));
    window.history.pushState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`);
  }

  return (
    <section id="journey-explorer" className="mx-auto max-w-5xl scroll-mt-24 px-5 pb-20 sm:px-8 sm:pb-24" aria-label="旅程时间线">
      <form role="search" aria-label="查找旅程" className="journey-filters" onSubmit={event => event.preventDefault()}>
        <div className="journey-filter-query">
          <label htmlFor="journey-query">寻找一段旅程</label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
            <input id="journey-query" type="search" maxLength={100} autoComplete="off" placeholder="搜索城市或游记标题" value={query}
              onCompositionStart={() => { composing.current = true; setIsComposing(true); }}
              onCompositionEnd={event => {
                composing.current = false;
                setIsComposing(false);
                setQuery(event.currentTarget.value);
                update("q", event.currentTarget.value);
              }}
              onChange={event => {
                setQuery(event.target.value);
                if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) update("q", event.target.value);
              }} />
          </div>
        </div>
        <div>
          <label htmlFor="journey-rating">评级</label>
          <select id="journey-rating" value={filters.rating} onChange={event => update("rating", event.target.value)}>
            <option value="">全部评级</option>
            {[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{RATING_LABELS[rating]}</option>)}
          </select>
        </div>
      </form>
      <div className="home-timeline">
        <YearNav key={years.join(",")} years={years} />
        <div className={`min-w-0 ${years.length <= 1 ? "lg:col-span-2" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 py-6 lg:pb-8 lg:pt-0">
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
              {active ? "找到" : "共"} {tripCount} 段旅程{schoolCount > 0 && ` · ${schoolCount} 条求学足迹`}
            </p>
            {active && <button type="button" onClick={reset} className="journey-clear">清除筛选</button>}
          </div>
          <div className="journey-years">
            {years.map(year => <div key={year} id={`year-${year}`} className="scroll-mt-36 lg:scroll-mt-24">
              <h2 className="journey-year-heading border-b border-hairline">
                <span className="select-none font-display text-4xl leading-none font-normal tracking-[-1px] text-primary tabular-nums">{year}</span>
                <span className="mt-1 select-none font-display text-xl leading-none text-primary/30">年</span>
              </h2>
              <div className="journey-year-list">
                {groups.get(year)!.map(item => <div key={`${item.kind}-${item.id}`} className="journey-result">{item.content}</div>)}
              </div>
            </div>)}
          </div>
          {filtered.length === 0 && <div className="journey-empty">
            <p className="mb-2 font-display text-2xl text-ink">{items.length ? "暂时没有找到这段旅程" : "旅程还在路上"}</p>
            <p className="text-sm leading-relaxed text-muted">{items.length ? "换个城市、标题或筛选条件试试。" : "新的足迹，会从这里开始。"}</p>
            {active && <button type="button" onClick={reset} className="journey-clear mt-4">查看全部旅程</button>}
          </div>}
        </div>
      </div>
    </section>
  );
}
