"use client";

import { Suspense, type ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withJourneyFilters } from "@/lib/journey-browsing";

type JourneyLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

function FilteredLink({ href, ...props }: JourneyLinkProps) {
  const params = useSearchParams();
  return <Link {...props} href={withJourneyFilters(href, params)} />;
}

export default function JourneyLink(props: JourneyLinkProps) {
  return <Suspense fallback={<Link {...props} />}><FilteredLink {...props} /></Suspense>;
}
