"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getTheme = () => document.documentElement.classList.contains("dark");
const getServerTheme = () => false;

export default function Nav() {
  const pathname = usePathname();
  const isDark = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  function toggleDark() {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* Storage can be disabled. */ }
  }

  const links = [
    { href: "/", label: "首页" },
    { href: "/map", label: "地图" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-canvas/80 backdrop-blur-2xl border-b border-hairline">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <Link href="/" className="flex items-center gap-2.5 group">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <path d="M12 2L2 22h20L12 2z" />
          <path d="M12 2l4 10H8l4-10z" opacity="0.4" />
        </svg>
        <span className="font-display text-xl tracking-[-0.5px] text-ink group-hover:text-primary transition-colors">
          Cloutains的旅程
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-7">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`relative text-sm font-medium transition-colors pb-1 ${
              pathname === href
                ? "text-ink after:absolute after:bottom-[-17px] after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          onClick={toggleDark}
          className="ml-2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-soft transition-all"
          aria-label="切换暗黑模式"
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex md:hidden items-center gap-4">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition-colors ${
              pathname === href
                ? "text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          onClick={toggleDark}
          className="p-1 rounded-lg text-muted hover:text-ink transition-colors"
          aria-label="切换暗黑模式"
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
          )}
        </button>
      </div>
    </nav>
  );
}
