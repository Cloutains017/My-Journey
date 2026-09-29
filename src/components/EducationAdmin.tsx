"use client";

import { useCallback, useEffect, useState } from "react";
import type { Education } from "@/lib/types";

const empty: Partial<Education> = { degree: "", school: "", date: "", location: "", city_name: "", latitude: 0, longitude: 0 };
const inputClass = "w-full rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-[#8A5AB4]";

export default function EducationAdmin() {
  const [items, setItems] = useState<Education[]>([]);
  const [editing, setEditing] = useState<Partial<Education> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/education", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "加载求学足迹失败");
    setItems(body);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/education", { cache: "no-store", signal: controller.signal })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "加载求学足迹失败");
        if (!controller.signal.aborted) setItems(body);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const url = editing.id ? `/api/admin/education/${encodeURIComponent(editing.id)}` : "/api/admin/education";
      const res = await fetch(url, { method: editing.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "保存失败");
      await refresh();
      setEditing(null);
      setMessage("求学足迹已保存");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { setSaving(false); }
  }

  async function remove(item: Education) {
    if (!confirm(`删除 ${item.school} 的求学足迹？`)) return;
    setError(""); setMessage("");
    try {
      const res = await fetch(`/api/admin/education/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "删除失败");
      await refresh();
      setMessage("求学足迹已删除");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); }
  }

  return <div className="max-w-2xl">
    <div className="mb-6 flex items-center justify-between gap-4">
      <div><h2 className="text-xl font-bold text-ink">求学足迹</h2><p className="text-sm text-muted">共 {items.length} 条记录</p></div>
      <button type="button" onClick={() => { setEditing({ ...empty }); setError(""); }} className="rounded-lg bg-[#8A5AB4] px-5 py-2.5 text-sm font-semibold text-white">+ 新建足迹</button>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="mb-4 text-sm text-[#8A5AB4]">{message}</p>}
    {editing ? <form onSubmit={save} className="flex flex-col gap-5 rounded-xl border border-[#8A5AB4]/30 bg-[#8A5AB4]/5 p-5">
      <h3 className="text-lg font-semibold text-ink">{editing.id ? "编辑求学足迹" : "新建求学足迹"}</h3>
      <label className="text-xs text-muted">学历名称<input required value={editing.degree || ""} onChange={e => setEditing({ ...editing, degree: e.target.value })} className={`${inputClass} mt-1.5`} placeholder="例如：本科" /></label>
      <label className="text-xs text-muted">学校名称<input required value={editing.school || ""} onChange={e => setEditing({ ...editing, school: e.target.value })} className={`${inputClass} mt-1.5`} /></label>
      <label className="text-xs font-semibold text-[#8A5AB4]">开始日期<input required type="date" value={editing.date || ""} onChange={e => setEditing({ ...editing, date: e.target.value })} className={`${inputClass} mt-1.5`} /></label>
      <fieldset><legend className="mb-2 text-xs text-muted">所在地区</legend><div className="flex gap-2">
        <button type="button" aria-pressed={editing.city_name !== null} onClick={() => setEditing({ ...editing, city_name: editing.city_name || "" })} className={`rounded-lg border px-4 py-2 text-sm ${editing.city_name !== null ? "border-[#8A5AB4] bg-[#8A5AB4]/15 text-[#8A5AB4]" : "border-hairline text-muted"}`}>中国境内</button>
        <button type="button" aria-pressed={editing.city_name === null} onClick={() => setEditing({ ...editing, city_name: null })} className={`rounded-lg border px-4 py-2 text-sm ${editing.city_name === null ? "border-[#8A5AB4] bg-[#8A5AB4]/15 text-[#8A5AB4]" : "border-hairline text-muted"}`}>境外</button>
      </div></fieldset>
      <label className="text-xs text-muted">地点名称<input required value={editing.location || ""} onChange={e => setEditing({ ...editing, location: e.target.value })} className={`${inputClass} mt-1.5`} placeholder="例如：福州市 / 新加坡" /></label>
      {editing.city_name !== null && <label className="text-xs text-muted">地级行政区名称<input required value={editing.city_name || ""} onChange={e => setEditing({ ...editing, city_name: e.target.value })} className={`${inputClass} mt-1.5`} placeholder="例如：福州市" /></label>}
      <div className="flex gap-4">
        <label className="flex-1 text-xs text-muted">纬度<input required type="number" step="any" min="-90" max="90" value={editing.latitude ?? ""} onChange={e => setEditing({ ...editing, latitude: Number(e.target.value) })} className={`${inputClass} mt-1.5`} /></label>
        <label className="flex-1 text-xs text-muted">经度<input required type="number" step="any" min="-180" max="180" value={editing.longitude ?? ""} onChange={e => setEditing({ ...editing, longitude: Number(e.target.value) })} className={`${inputClass} mt-1.5`} /></label>
      </div>
      <p className="text-xs text-muted">境外地点按经纬度定位；中国境内地点高亮对应行政区。</p>
      <div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-[#8A5AB4] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-hairline px-5 py-2 text-sm text-muted">取消</button></div>
    </form> : <div className="flex flex-col gap-2">{items.map(item => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-hairline-soft bg-surface-card p-4">
      <span className="h-3 w-3 shrink-0 rounded-full bg-[#8A5AB4]" />
      <div className="min-w-0 flex-1"><p className="font-semibold text-ink">{item.degree} · {item.school}</p><p className="text-xs text-muted">{item.date} 开始 · {item.location}</p></div>
      <button type="button" onClick={() => setEditing(item)} className="text-xs text-muted hover:text-ink">编辑</button>
      <button type="button" onClick={() => void remove(item)} className="text-xs text-red-500">删除</button>
    </div>)}</div>}
  </div>;
}
