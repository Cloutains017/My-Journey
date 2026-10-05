"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { observeMobileCardRules } from "@/lib/mobile-card-rules";

export default function JourneyCardList({ children, itemKey }: { children: ReactNode; itemKey: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return observeMobileCardRules(root.current);
  }, [itemKey]);
  return <div className="journey-years" ref={root}>{children}</div>;
}
