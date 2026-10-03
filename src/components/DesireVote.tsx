"use client";

import { useRef, useState } from "react";
import { DESIRE_LABELS } from "@/lib/types";
import { ACTIVE_VOTE_COLORS, VOTE_COLORS } from "@/components/voteStyles";

export default function DesireVote({ tripId }: { tripId: string }) {
  const [desire, setDesire] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!desire || !nickname.trim() || pendingRef.current) return;
    pendingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/votes/desire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, desireLevel: desire, nickname: nickname.trim(), comment: comment.trim() || null }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        setError(typeof result?.error === "string" ? result.error : "暂时无法提交，请稍后重试。");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("网络连接中断或等待超时，请稍后重试。你的填写内容已保留。");
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <div role="status" className="vote-success">
      <svg className="vote-success-check" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" /><path d="m7 12 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <p>你的想法已记录，感谢分享！</p>
    </div>;
  }

  const indicatorPos = desire ? `${(desire - 1) * 25}%` : "-10px";

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting} className="vote-form py-8 border-t border-hairline">
      <h3 className="text-lg font-semibold text-ink mb-1 font-sans">看完之后，你有多想去这里？</h3>
      <p className="text-sm text-muted mb-5 font-sans">选择你的心动指数</p>

      {/* Spectrum bar: left=strong desire(primary), right=weak desire(muted) */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-accent-teal/40 via-surface-card to-primary/40 mb-5">
        {desire && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-ink border-2 border-canvas shadow-sm transition-all duration-300"
            style={{ left: indicatorPos, transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={desire === v}
            disabled={submitting}
            onClick={() => setDesire(v)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer font-sans ${VOTE_COLORS[v]} ${desire === v ? ACTIVE_VOTE_COLORS[v] : ""}`}
          >
            {DESIRE_LABELS[v]}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          aria-label="心动指数昵称"
          disabled={submitting}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="你的昵称"
          maxLength={20}
          className="w-full sm:w-40 bg-canvas border border-hairline rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-muted-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 font-sans"
        />
        <input
          aria-label="心动指数留言（可选）"
          disabled={submitting}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="说说为什么（可选）"
          maxLength={500}
          className="flex-1 bg-canvas border border-hairline rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-muted-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 font-sans"
        />
        <button
          type="submit"
          disabled={!desire || !nickname.trim() || submitting}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-primary-active transition-colors font-sans whitespace-nowrap"
        >
          {submitting ? "提交中..." : "提交"}
        </button>
      </div>
      {error && <p role="alert" className="vote-error mt-3 text-sm">{error}</p>}
    </form>
  );
}
