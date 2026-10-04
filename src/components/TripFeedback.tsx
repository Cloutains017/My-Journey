"use client";

import { useRef, useState } from "react";
import { AGREEMENT_LABELS, DESIRE_LABELS, RATING_LABELS, RATING_DESCRIPTIONS } from "@/lib/types";
import { ACTIVE_VOTE_COLORS, VOTE_COLORS } from "@/components/voteStyles";

type Kind = "agreement" | "desire";
const QUESTIONS = [
  { kind: "agreement" as const, title: "你认同博主的评级吗？", labels: AGREEMENT_LABELS, name: "认可度" },
  { kind: "desire" as const, title: "看完之后，你有多想去这里？", labels: DESIRE_LABELS, name: "心动指数" },
];

export default function TripFeedback({ tripId, rating }: { tripId: string; rating: number }) {
  const [draft, setDraft] = useState({ agreement: null as number | null, desire: null as number | null, nickname: "", comment: "" });
  const [saved, setSaved] = useState({ agreement: false, desire: false });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const pendingRef = useRef(false);
  const selected = draft.agreement !== null || draft.desire !== null;
  const partiallySaved = saved.agreement || saved.desire;
  const hasUnsaved = QUESTIONS.some(({ kind }) => draft[kind] !== null && !saved[kind]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasUnsaved || !draft.nickname.trim() || pendingRef.current) return;
    pendingRef.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      const results = await Promise.all(QUESTIONS.filter(({ kind }) => draft[kind] !== null && !saved[kind]).map(async ({ kind }) => {
        try {
          const response = await fetch(`/api/votes/${kind}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, nickname: draft.nickname.trim(), comment: draft.comment.trim() || null,
              ...(kind === "agreement" ? { agreement: draft.agreement } : { desireLevel: draft.desire }) }),
            signal: AbortSignal.timeout(15000),
          });
          const result = await response.json().catch(() => null);
          return { kind, success: response.ok && result?.success === true,
            error: typeof result?.error === "string" ? result.error : "暂时无法提交，请稍后重试。" };
        } catch {
          return { kind, success: false, error: "网络连接中断或等待超时，请稍后重试。你的填写内容已保留。" };
        }
      }));
      const nextSaved = { ...saved };
      const nextErrors: Partial<Record<Kind, string>> = {};
      results.forEach(result => {
        if (result.success) nextSaved[result.kind] = true;
        else nextErrors[result.kind] = result.error;
      });
      setSaved(nextSaved);
      setErrors(nextErrors);
      if (results.every(result => result.success)) setSubmitted(true);
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) return (
    <section className="trip-feedback" aria-labelledby={`feedback-title-${tripId}`}>
      <h2 id={`feedback-title-${tripId}`} className="feedback-title">留下你的感受</h2>
      <div role="status" className="feedback-confirmation">
        <p>你的感受已记录，感谢分享！</p>
        <p className="feedback-receipt">{saved.agreement && `认可度：${AGREEMENT_LABELS[draft.agreement!]}`}{saved.agreement && saved.desire && " · "}{saved.desire && `心动指数：${DESIRE_LABELS[draft.desire!]}`}</p>
      </div>
    </section>
  );

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting} aria-labelledby={`feedback-title-${tripId}`} className="vote-form trip-feedback">
      <h2 id={`feedback-title-${tripId}`} className="feedback-title">留下你的感受</h2>
      <p className="feedback-intro">选一个或两个评价，用一个昵称分享你的想法。</p>
      <div className="feedback-questions">
        {QUESTIONS.map(({ kind, title, labels, name }) => (
          <fieldset key={kind} className="feedback-question" disabled={submitting || saved[kind]}>
            <legend>{title}</legend>
            {kind === "agreement" ? <p className="feedback-question-hint">博主评级：{RATING_LABELS[rating]} · {RATING_DESCRIPTIONS[rating]}</p> : <p className="feedback-question-hint">选择你的心动指数</p>}
            <div className="feedback-choices">
              {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-pressed={draft[kind] === value}
                disabled={submitting || saved[kind]}
                onClick={() => { setDraft(previous => ({ ...previous, [kind]: previous[kind] === value ? null : value })); setErrors(previous => ({ ...previous, [kind]: undefined })); }}
                className={`feedback-choice ${VOTE_COLORS[value]} ${draft[kind] === value ? ACTIVE_VOTE_COLORS[value] : ""}`}>{labels[value]}</button>)}
            </div>
            {saved[kind] && <p role="status" className="feedback-saved">{name}已保存</p>}
            {errors[kind] && <p role="alert" className="vote-error feedback-question-error">{name}：{errors[kind]}</p>}
          </fieldset>
        ))}
      </div>
      <details className="feedback-rating-guide">
        <summary>评级用语说明</summary>
        <dl>{[1, 2, 3, 4, 5].map(value => <div key={value}><dt>{RATING_LABELS[value]}</dt><dd>{RATING_DESCRIPTIONS[value]}</dd></div>)}</dl>
      </details>
      <div className="feedback-compose">
        <div className="feedback-nickname">
          <label htmlFor={`feedback-nickname-${tripId}`}>你的昵称</label>
          <input id={`feedback-nickname-${tripId}`} aria-label="你的昵称" required maxLength={20} autoComplete="nickname" value={draft.nickname}
            disabled={submitting || partiallySaved} placeholder="怎么称呼你？"
            onChange={event => setDraft(previous => ({ ...previous, nickname: event.target.value }))} />
        </div>
        {selected && <div className="feedback-comment">
          <label htmlFor={`feedback-comment-${tripId}`}>留言 <span>（可选）</span></label>
          <textarea id={`feedback-comment-${tripId}`} aria-label="留言（可选）" rows={3} maxLength={500} value={draft.comment}
            disabled={submitting || partiallySaved} placeholder="哪一段打动了你？也可以说说不同的看法。"
            onChange={event => setDraft(previous => ({ ...previous, comment: event.target.value }))} />
        </div>}
        <div className="feedback-submit-row">
          <p>{partiallySaved ? "已保存的评价会保留，重试只提交未保存的部分。" : "留言可以留空，昵称与留言会公开展示。"}</p>
          <div className="feedback-submit-actions">
            {partiallySaved && <button type="button" disabled={submitting} className="feedback-finish" onClick={() => setSubmitted(true)}>仅保留已保存的评价</button>}
            <button type="submit" disabled={!hasUnsaved || !draft.nickname.trim() || submitting} className="feedback-submit">{submitting ? "提交中…" : partiallySaved ? "重试未保存的评价" : "提交感受"}</button>
          </div>
        </div>
      </div>
    </form>
  );
}
