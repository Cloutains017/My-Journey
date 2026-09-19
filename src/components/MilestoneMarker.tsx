import type { Milestone } from "@/lib/types";

const ICONS: Record<string, string> = {
  school: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  middle: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5",
  high:   "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z",
  uni:    "M4.26 16.191l7.74-4.661 7.74 4.661M12 2.25l-9 5.25 9 5.25 9-5.25-9-5.25z M12 12.75v8.25M9.75 15.75L12 12.75l2.25 3M12 21c-1.5 0-4.5-3-4.5-3s3-1.5 4.5-1.5 4.5 1.5 4.5 1.5-3 3-4.5 3z",
  grad:   "M12 2l10 6-3 1.8V18l-7 4-7-4v-4.2L2 8l10-6z M12 12l7-4.2M12 12l-7-4.2M9 20l3 2 3-2M12 14v8",
};

const STAGE_LABEL: Record<string, string> = {
  school: "小学",
  middle: "初中",
  high: "高中",
  uni: "大学",
  grad: "研究生",
};

export default function MilestoneMarker({ milestone }: { milestone: Milestone }) {
  const d = ICONS[milestone.icon] || ICONS.school;
  const stage = milestone.stage || STAGE_LABEL[milestone.icon] || "";
  const year = milestone.date.slice(0, 4);
  const monthDay = milestone.date.slice(5);

  return (
    <div className="relative group">
      {/* Milestone card */}
      <div className="relative overflow-hidden rounded-lg border border-hairline-soft hover:border-accent-amber/20 transition-colors duration-500">
        {/* Top accent stripe */}
        <div className="absolute top-0 left-0 w-1/3 h-[2px] bg-gradient-to-r from-accent-amber/40 to-transparent" />

        <div className="relative flex items-center gap-4 sm:gap-5 px-5 py-4 bg-gradient-to-r from-accent-amber/[0.04] via-accent-amber/[0.02] to-transparent">
          {/* Icon — diamond shaped */}
          <div className="w-10 h-10 rounded-sm rotate-45 bg-accent-amber/[0.08] text-accent-amber flex items-center justify-center flex-shrink-0 group-hover:bg-accent-amber/15 transition-all duration-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="-rotate-45">
              <path d={d} />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-[3px] text-accent-amber/55 font-sans font-medium select-none">
                {stage}
              </span>
            </div>
            <h4 className="text-sm font-medium text-ink/85 font-display tracking-[-0.2px]">
              {milestone.title}
            </h4>
            {milestone.subtitle && (
              <p className="text-xs text-muted-soft mt-0.5 font-sans">{milestone.subtitle}</p>
            )}
          </div>

          {/* Date */}
          <div className="text-right flex-shrink-0">
            <p className="font-display text-lg text-accent-amber/45 tabular-nums leading-none">
              {year}
            </p>
            <p className="text-[10px] text-muted-soft mt-0.5 font-sans tabular-nums leading-none">
              {monthDay}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
