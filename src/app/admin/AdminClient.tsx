"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TravelImage from "@/components/TravelImage";
import { makePhotoVariants } from "@/lib/browser-photo-variants";
import AdminSecurityPanel from "@/components/AdminSecurityPanel";
import PhotoGroupEditor from "@/components/PhotoGroupEditor";
import { RATING_LABELS, AGREEMENT_LABELS, DESIRE_LABELS, formatDateRange } from "@/lib/types";
import type { Trip, Photo, AgreementVote, DesireVote } from "@/lib/types";
import { deletePhotos } from "@/lib/photo-batch-delete";

export default function AdminClient() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [editing, setEditing] = useState<Partial<Trip> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoRows, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [commentsMode, setCommentsMode] = useState(false);
  const [securityMode, setSecurityMode] = useState(false);
  const [comments, setComments] = useState<{ agreements: (AgreementVote & { trips?: { title: string } | null })[], desires: (DesireVote & { trips?: { title: string } | null })[] }>({ agreements: [], desires: [] });
  const photos = photoRows.filter((photo) => photo.trip_id === editing?.id);
  const editingId = editing?.id;
  const [selection, setSelection] = useState<{ tripId: string | undefined; ids: string[] }>({ tripId: editingId, ids: [] });
  const [deletingPhotos, setDeletingPhotos] = useState(false);
  const deletingPhotosRef = useRef(false);
  const selectedIds = selection.tripId === editingId ? selection.ids.filter(id => photos.some(photo => photo.id === id)) : [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openEditor(next: Partial<Trip> | null) {
    setSelection({ tripId: next?.id, ids: [] });
    setEditing(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setAuthenticated(true); setPassword(""); setError(""); }
    else { const data = await res.json(); setError(data.error || "登录失败"); }
  }

  const fetchTrips = useCallback(async () => {
    const res = await fetch("/api/admin/trips", { cache: "no-store" });
    if (res.ok) setTrips(await res.json());
    else setAuthenticated(false);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    fetch("/api/admin/trips", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (res.ok) { const data = await res.json(); if (!controller.signal.aborted) setTrips(data); }
        else if (res.status === 401) setAuthenticated(false);
        else setError("加载旅程失败");
      }).catch(() => { if (!controller.signal.aborted) setError("加载旅程失败"); });
    return () => controller.abort();
  }, [authenticated]);

  const fetchPhotos = useCallback(async (tripId: string) => {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("photos").select("*").eq("trip_id", tripId).order("sort_order");
    if (data) setPhotos(data as Photo[]);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    async function loadPhotos() {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data, error } = await supabase.from("photos").select("*").eq("trip_id", editingId!).order("sort_order");
        if (cancelled) return;
        if (error) setError("加载照片失败");
        else setPhotos((data || []) as Photo[]);
      } catch { if (!cancelled) setError("加载照片失败"); }
    }
    void loadPhotos();
    return () => { cancelled = true; };
  }, [editingId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (deletingPhotosRef.current) return;
    if (!editing) return;
    const tripData = { ...editing };
    const isNew = !tripData.id;
    const url = isNew ? "/api/admin/trips" : `/api/admin/trips/${tripData.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tripData),
    });
    if (res.ok) {
      const saved = await res.json();
      setMessage(isNew ? "旅程已创建，现在可以上传照片" : "保存成功");
      fetchTrips();
      if (isNew && saved?.id) {
        openEditor({ ...editing, id: saved.id });
      } else {
        openEditor(null);
      }
    } else {
      const data = await res.json();
      setError(data.error || "保存失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("将旅程及其照片、评论移入回收站？之后可以恢复。")) return;
    const res = await fetch(`/api/admin/trips/${id}`, { method: "DELETE" });
    if (res.ok) { setMessage("已移入回收站"); fetchTrips(); }
    else setError("删除失败");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (deletingPhotosRef.current) return;
    const files = e.target.files;
    if (!files || files.length === 0 || !editing?.id) return;
    setUploading(true);
    setError("");

    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) throw new Error("单张照片不能超过 50 MB");
        const variants = await makePhotoVariants(file);
        const fileName = `${Date.now()}-${file.name}`;

        // 1. 获取签名 URL
        const presignRes = await fetch("/api/admin/photos/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId: editing.id, fileName, contentType: file.type }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.error || "获取上传凭证失败");
        }
        const { presignedUrl, thumbPresignedUrl, heroPresignedUrl, publicUrl } = await presignRes.json();

        // 2. 直传 R2
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) {
          throw new Error(`上传失败: ${uploadRes.status}`);
        }
        for (const [url, blob] of [
          [thumbPresignedUrl, variants.thumb],
          [heroPresignedUrl, variants.hero],
        ] as const) {
          const variantRes = await fetch(url, {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": "image/webp" },
          });
          if (!variantRes.ok) throw new Error(`缩略图上传失败: ${variantRes.status}`);
        }
        // Save each completed photo before starting the next one, so a later
        // failure does not hide successfully uploaded photos from the gallery.
        const registerRes = await fetch("/api/admin/photos/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId: editing.id, urls: [publicUrl] }),
        });
        if (!registerRes.ok) {
          const err = await registerRes.json();
          throw new Error(err.error || "注册照片失败");
        }
        uploadedCount++;
      }

      setMessage(`照片上传成功 · ${uploadedCount} 张`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "上传失败";
      setError(uploadedCount ? `${reason}；已保存 ${uploadedCount} 张照片` : reason);
    }
    if (uploadedCount) {
      try {
        await fetchPhotos(editing.id);
      } catch {
        setError("照片已保存，但列表刷新失败，请重新打开旅程查看");
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePhotoDelete(ids: string[]) {
    if (deletingPhotosRef.current || uploading || !editingId) return;
    const targets = photos.filter(photo => ids.includes(photo.id));
    if (!targets.length || !confirm(`将所选 ${targets.length} 张照片移入回收站？原图会保留，之后可以恢复。`)) return;
    deletingPhotosRef.current = true;
    setDeletingPhotos(true);
    setError("");
    setMessage("");
    try {
      const { deletedIds, failedIds } = await deletePhotos(targets.map(photo => photo.id));
      const removedUrls = new Set(targets.filter(photo => deletedIds.includes(photo.id)).map(photo => photo.url));
      setPhotos(prev => prev.filter(photo => !deletedIds.includes(photo.id)));
      setEditing(prev => prev?.id === editingId && prev.cover_image && removedUrls.has(prev.cover_image) ? { ...prev, cover_image: null } : prev);
      setTrips(prev => prev.map(trip => trip.id === editingId && trip.cover_image && removedUrls.has(trip.cover_image) ? { ...trip, cover_image: null } : trip));
      setSelection(prev => prev.tripId === editingId ? { ...prev, ids: failedIds } : prev);
      if (deletedIds.length) setMessage(`${deletedIds.length} 张照片已移入回收站`);
      if (failedIds.length) setError(`${failedIds.length} 张照片未能确认删除，已保留勾选。请刷新列表并检查回收站后重试。`);
    } finally {
      deletingPhotosRef.current = false;
      setDeletingPhotos(false);
    }
  }

  const fetchComments = useCallback(async () => {
    const res = await fetch("/api/admin/votes");
    if (res.ok) setComments(await res.json());
    else setAuthenticated(false);
  }, []);

  useEffect(() => {
    if (!authenticated || !commentsMode) return;
    const controller = new AbortController();
    fetch("/api/admin/votes", { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) { const data = await res.json(); if (!controller.signal.aborted) setComments(data); }
        else if (res.status === 401) setAuthenticated(false);
        else setError("加载评论失败");
      }).catch(() => { if (!controller.signal.aborted) setError("加载评论失败"); });
    return () => controller.abort();
  }, [authenticated, commentsMode]);

  async function handleCommentDelete(type: "agreement" | "desire", id: string) {
    if (!confirm("将这条评论移入回收站？")) return;
    const res = await fetch(`/api/admin/votes/${type}/${id}`, { method: "DELETE" });
    if (res.ok) { setMessage("评论已移入回收站"); fetchComments(); }
    else { const data = await res.json(); setError(data.error || "删除失败"); }
  }

  function mergeComments() {
    const all: { id: string; type: "agreement" | "desire"; nickname: string; label: string; comment: string | null; time: string; tripTitle: string }[] = [];
    comments.agreements.forEach((v) =>
      all.push({ id: v.id, type: "agreement", nickname: v.nickname, label: AGREEMENT_LABELS[v.agreement], comment: v.comment, time: v.created_at, tripTitle: v.trips?.title || "—" })
    );
    comments.desires.forEach((v) =>
      all.push({ id: v.id, type: "desire", nickname: v.nickname, label: DESIRE_LABELS[v.desire_level], comment: v.comment, time: v.created_at, tripTitle: v.trips?.title || "—" })
    );
    all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return all;
  }

  const emptyTrip: Partial<Trip> = {
    title: "", slug: "", date: "", end_date: null, location: "", city_name: null, latitude: 35, longitude: 115,
    content: "", rating: 3, cover_image: "",
  };

  const inputClass = "w-full bg-canvas border border-hairline rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-muted-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <form onSubmit={handleLogin} className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-ink font-sans">🔐 身份验证</h2>
          <p className="text-sm text-muted mb-4">请输入管理密码以继续</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-72 bg-canvas border border-hairline rounded-xl px-5 py-3 text-sm text-ink text-center placeholder:text-muted-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" className="px-10 py-3 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary-active transition-colors">
            进入后台
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <aside className="w-52 p-6 border-r border-hairline flex-shrink-0">
        <p className="text-sm font-bold text-ink mb-6">📋 管理面板</p>
        <nav className="flex flex-col gap-4 text-sm">
          <button onClick={() => { setSecurityMode(false); openEditor(null); setMessage(""); setCommentsMode(false); fetchTrips(); }} className={`text-left transition-colors ${!commentsMode && !securityMode ? "text-ink font-semibold" : "text-muted hover:text-ink"}`}>
            旅程列表
          </button>
          <button onClick={() => { setSecurityMode(false); openEditor(null); setCommentsMode(true); setMessage(""); fetchComments(); }} className={`text-left transition-colors ${commentsMode && !securityMode ? "text-ink font-semibold" : "text-muted hover:text-ink"}`}>
            评论管理
          </button>
          <button onClick={() => { setSecurityMode(false); openEditor(emptyTrip); setCommentsMode(false); }} className="text-left text-muted hover:text-ink transition-colors">
            + 新建旅程
          </button>
          <button onClick={() => { setSecurityMode(true); openEditor(null); setMessage(""); setError(""); }} className={`text-left ${securityMode ? "text-ink font-semibold" : "text-muted"}`}>回收站与操作记录</button>
          <button onClick={async () => {
            try {
              const res = await fetch("/api/admin/auth", { method: "DELETE" });
              if (!res.ok) throw new Error();
              setAuthenticated(false); openEditor(null); setPhotos([]); setTrips([]); setError(""); setMessage(""); setSecurityMode(false);
            } catch { setError("退出失败，请重试"); }
          }} className="text-left text-muted">退出登录</button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        {message && <p className="text-sm text-accent-teal font-medium mb-4">{message}</p>}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {securityMode ? <AdminSecurityPanel /> : commentsMode ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink">评论管理</h2>
                <p className="text-sm text-muted">共 {mergeComments().length} 条评论</p>
              </div>
            </div>
            {mergeComments().length === 0 ? (
              <p className="text-sm text-muted py-10 text-center">暂无访客评论</p>
            ) : (
              <div className="flex flex-col gap-2">
                {mergeComments().map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-4 p-4 bg-surface-card rounded-xl border border-hairline-soft">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      item.type === "agreement" ? "bg-accent-teal/10 text-accent-teal" : "bg-primary/10 text-primary"
                    }`}>
                      {item.type === "agreement" ? "✓" : "🔥"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-ink">{item.nickname}</span>
                        <span className="text-xs text-muted">· {item.label}</span>
                        <span className="text-xs text-muted-soft">· {item.tripTitle}</span>
                      </div>
                      {item.comment && <p className="text-xs text-body truncate">{item.comment}</p>}
                      <p className="text-[10px] text-muted-soft mt-0.5">{new Date(item.time).toLocaleString("zh-CN")}</p>
                    </div>
                    <button
                      onClick={() => handleCommentDelete(item.type, item.id)}
                      className="text-xs text-red-400/60 hover:text-red-500 flex-shrink-0"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : !editing ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink">我的旅程</h2>
                <p className="text-sm text-muted">共 {trips.length} 段旅程</p>
              </div>
              <button onClick={() => { openEditor(emptyTrip); setCommentsMode(false); }} className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-active transition-colors">
                + 新建旅程
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {trips.map((trip) => (
                <div key={trip.id} className="flex items-center gap-4 p-4 bg-surface-card rounded-xl border border-hairline-soft">
                  <div className="w-12 h-12 rounded-lg bg-surface-cream-strong flex-shrink-0 overflow-hidden">
                    {trip.cover_image && <TravelImage src={trip.cover_image} alt="" width={96} height={64} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{trip.title}</p>
                    <p className="text-xs text-muted">{formatDateRange(trip.date, trip.end_date)} · {RATING_LABELS[trip.rating]}</p>
                  </div>
                  <button onClick={() => openEditor(trip)} className="text-xs text-muted hover:text-ink transition-colors">编辑</button>
                  <button onClick={() => { openEditor(trip); }} className="text-xs text-primary/70 hover:text-primary transition-colors">照片</button>
                  <button onClick={() => handleDelete(trip.id)} className="text-xs text-red-400/60 hover:text-red-500 transition-colors">删除</button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-2xl">
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <h3 className="text-lg font-bold text-ink">{editing.id ? "编辑旅程" : "新建旅程"}</h3>

              <div>
                <label className="text-xs text-muted mb-1.5 block">标题</label>
                <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className={inputClass} />
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">URL 标识（留空则自动生成）</label>
                <input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="例如：my-trip-to-beijing" className={inputClass} />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1.5 block">开始日期</label>
                  <input value={editing.date || ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    type="date" className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1.5 block">结束日期（可选）</label>
                  <input value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value || null })}
                    type="date" className={inputClass} />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">地点（用于展示给访客）</label>
                <input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  placeholder="例如：平潭县，福州市，福建省" className={inputClass} />
              </div>

              {/* 境内 / 境外 toggle */}
              <div>
                <label className="text-xs text-muted mb-1.5 block">地图高亮方式</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing({ ...editing, city_name: "" })}
                    className={`px-5 py-2.5 rounded-lg text-sm border transition-all ${
                      editing.city_name !== null && editing.city_name !== undefined
                        ? "bg-accent-teal/10 border-accent-teal/30 text-accent-teal font-semibold"
                        : "bg-surface-card border-hairline text-muted"
                    }`}
                  >🇨🇳 中国境内</button>
                  <button type="button" onClick={() => setEditing({ ...editing, city_name: null })}
                    className={`px-5 py-2.5 rounded-lg text-sm border transition-all ${
                      editing.city_name === null
                        ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                        : "bg-surface-card border-hairline text-muted"
                    }`}
                  >🌍 境外</button>
                </div>
              </div>

              {/* 境内：地级行政区输入 */}
              {editing.city_name !== null && editing.city_name !== undefined && (
                <div>
                  <label className="text-xs text-muted mb-1.5 block">地级行政区名称（用于点亮地图区域）</label>
                  <input value={editing.city_name || ""} onChange={(e) => setEditing({ ...editing, city_name: e.target.value })}
                    placeholder="例如：福州市、杭州市、成都市......" className={inputClass} />
                  <p className="text-[10px] text-muted-soft mt-1">输入该旅程所属的地级行政区名称，系统将自动点亮该城市在地图上的整片区域</p>
                </div>
              )}

              {/* 境外：经纬度输入 */}
              {editing.city_name === null && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-muted mb-1.5 block">纬度</label>
                    <input type="number" step="0.000001" value={editing.latitude || ""} onChange={(e) => setEditing({ ...editing, latitude: parseFloat(e.target.value) })}
                      className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted mb-1.5 block">经度</label>
                    <input type="number" step="0.000001" value={editing.longitude || ""} onChange={(e) => setEditing({ ...editing, longitude: parseFloat(e.target.value) })}
                      className={inputClass} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted mb-1.5 block">封面图片 URL</label>
                <input value={editing.cover_image || ""} onChange={(e) => setEditing({ ...editing, cover_image: e.target.value })}
                  placeholder="https://... 或从下方照片中点击「设为封面」" className={inputClass} />
                {editing.cover_image && (
                  <TravelImage src={editing.cover_image} alt="封面预览" width={128} height={80} className="mt-2 w-32 h-20 object-cover rounded-lg border border-hairline" />
                )}
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">评级</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} type="button" onClick={() => setEditing({ ...editing, rating: v })}
                      className={`px-4 py-2 rounded-full text-sm border transition-all ${
                        editing.rating === v
                          ? "bg-primary/15 border-primary/50 text-primary font-semibold"
                          : "bg-surface-card border-hairline text-muted"
                      }`}
                    >{RATING_LABELS[v]}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">文字内容</label>
                <textarea value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={8} className={`${inputClass} resize-none`} />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { openEditor(null); }}
                  className="px-7 py-2.5 bg-surface-card border border-hairline rounded-lg text-sm text-muted hover:text-ink transition-colors">取消</button>
                <button type="submit" disabled={deletingPhotos}
                  className="px-7 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-active transition-colors">保存旅程</button>
              </div>
            </form>

            {/* Photo Management Section */}
            {editing.id && (
              <div className="mt-10 pt-8 border-t border-hairline">
                <h3 className="text-lg font-bold text-ink mb-4">📷 旅程照片 · {photos.length} 张</h3>
                {photos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <button type="button" disabled={deletingPhotos || uploading}
                      onClick={() => setSelection({ tripId: editingId, ids: selectedIds.length === photos.length ? [] : photos.map(photo => photo.id) })}
                      className="px-3 py-2 rounded-lg border border-hairline text-sm text-ink disabled:opacity-50">
                      {selectedIds.length === photos.length ? "取消全选" : "全选"}
                    </button>
                    <span className="text-sm text-body" role="status">已选 {selectedIds.length} / {photos.length} 张</span>
                    <button type="button" disabled={!selectedIds.length || deletingPhotos || uploading}
                      onClick={() => handlePhotoDelete(selectedIds)}
                      className="px-3 py-2 rounded-lg bg-red-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                      {deletingPhotos ? "正在移入回收站…" : `删除所选（${selectedIds.length}）`}
                    </button>
                  </div>
                )}

                {/* Existing photos grid */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" aria-busy={deletingPhotos}>
                    {photos.map((photo, index) => (
                      <div key={photo.id} className={`relative group aspect-square rounded-lg overflow-hidden bg-surface-cream-strong ${selectedIds.includes(photo.id) ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                        <TravelImage src={photo.url} alt={photo.caption || "旅程照片"} width={320} height={240} className="w-full h-full object-cover" />
                        <label className="absolute top-1 left-1 z-10 flex items-center justify-center w-11 h-11 rounded-lg bg-black/70 cursor-pointer">
                          <input type="checkbox" checked={selectedIds.includes(photo.id)} disabled={deletingPhotos || uploading}
                            aria-label={`选择第 ${index + 1} 张照片${photo.caption ? `：${photo.caption}` : ""}`}
                            onChange={event => setSelection({ tripId: editingId, ids: event.target.checked ? [...selectedIds, photo.id] : selectedIds.filter(id => id !== photo.id) })}
                            className="w-5 h-5 accent-primary" />
                        </label>
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 flex flex-wrap items-center justify-center gap-2">
                          <button type="button" disabled={deletingPhotos}
                            onClick={() => setEditing({ ...editing, cover_image: photo.url })}
                            className="px-2 py-1 rounded bg-canvas text-ink text-xs font-semibold hover:bg-white"
                          >
                            设为封面
                          </button>
                          <button type="button" disabled={deletingPhotos || uploading} aria-label={`删除第 ${index + 1} 张照片`}
                            onClick={() => handlePhotoDelete([photo.id])}
                            className="w-6 h-6 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center hover:bg-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload area */}
                <div className="border-2 border-dashed border-hairline rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files.length > 0 && fileInputRef.current) {
                      const dt = new DataTransfer();
                      Array.from(files).forEach((f) => dt.items.add(f));
                      fileInputRef.current.files = dt.files;
                      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  }}
                >
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm text-muted">
                    {uploading ? "上传中..." : "拖拽图片到此处或点击上传"}
                  </p>
                  <p className="text-xs text-muted-soft mt-1">支持 JPG, PNG, WebP · 原始画质上传 · 可批量选择</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading || deletingPhotos}
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <PhotoGroupEditor
                  key={editing.id}
                  tripId={editing.id}
                  photos={photos}
                  initialGroups={editing.photo_groups}
                  onSaved={groups => {
                    setEditing(current => current?.id === editing.id ? { ...current, photo_groups: groups } : current);
                    setTrips(current => current.map(trip => trip.id === editing.id ? { ...trip, photo_groups: groups } : trip));
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
