import type { AgreementVote, DesireVote } from "@/lib/types";
import { AGREEMENT_LABELS, DESIRE_LABELS } from "@/lib/types";
import { VOTE_COLORS } from "@/components/voteStyles";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  if (diffWeek < 5) return `${diffWeek}周前`;
  if (diffMonth < 12) return `${diffMonth}个月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

export default function VisitorComments({
  agreementVotes,
  desireVotes,
}: {
  agreementVotes: AgreementVote[];
  desireVotes: DesireVote[];
}) {
  if (agreementVotes.length === 0 && desireVotes.length === 0) {
    return (
      <div className="py-8 border-t border-hairline">
        <p className="text-xs uppercase tracking-[3px] text-muted-soft mb-6 font-medium font-sans">访客回声</p>
        <p className="text-sm text-muted font-sans">还没有人留下评价，来做第一个吧</p>
      </div>
    );
  }

  const all: { nickname: string; label: string; level: number; comment: string | null; time: string }[] = [];
  agreementVotes.forEach((v) =>
    all.push({ nickname: v.nickname, label: AGREEMENT_LABELS[v.agreement], level: v.agreement, comment: v.comment, time: v.created_at })
  );
  desireVotes.forEach((v) =>
    all.push({ nickname: v.nickname, label: DESIRE_LABELS[v.desire_level], level: v.desire_level, comment: v.comment, time: v.created_at })
  );
  all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="py-8 border-t border-hairline">
      <p className="text-xs uppercase tracking-[3px] text-muted-soft mb-6 font-medium font-sans">访客回声</p>
      <div className="flex flex-col divide-y divide-hairline-soft">
        {all.map((item, i) => (
          <div key={i} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0 font-sans">
                {item.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-ink/80 font-semibold text-sm font-sans">{item.nickname}</span>
                  <span className="text-[10px] text-muted-soft font-sans">{relativeTime(item.time)}</span>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 font-sans ${VOTE_COLORS[item.level]}`}>
                {item.label}
              </span>
            </div>
            {item.comment && <p className="text-sm text-body leading-relaxed pl-11 font-sans">{item.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
