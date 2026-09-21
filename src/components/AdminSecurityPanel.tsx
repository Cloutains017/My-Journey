"use client";

import { useEffect, useState } from 'react';

type Recycled = { id: string; target: string; label: string; created_at: string };
type Audit = { id: string; action: string; target: string; created_at: string; record_id: string | null };
const targets: Record<string,string> = { trips:'旅程', photos:'照片', agreement_votes:'认可度评论', desire_votes:'心动指数评论', city_boundaries:'城市边界', admin:'后台' };
const actions: Record<string,string> = { INSERT:'创建', UPDATE:'修改', DELETE:'移入回收站 / 删除记录', RESTORE:'恢复', LOGIN_SUCCESS:'登录成功', LOGIN_FAILURE:'登录失败' };

export default function AdminSecurityPanel() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Recycled[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const responses = await Promise.all([
          fetch(`/api/admin/recycle-bin?page=${page}`, { cache:'no-store', signal:controller.signal }),
          fetch('/api/admin/audit', { cache:'no-store', signal:controller.signal }),
        ]);
        const [recycleData, auditData] = await Promise.all(responses.map(r => r.json()));
        if (controller.signal.aborted) return;
        if (!responses[0].ok || !responses[1].ok) throw new Error(recycleData.error || auditData.error || '加载失败');
        setRows(recycleData); setAudit(auditData); setError(''); setLoaded(true);
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : '加载失败'); setLoaded(false); } }
    }
    void load();
    return () => controller.abort();
  },[page,revision]);
  async function restore(id: string) {
    if (!confirm('恢复这条记录及其关联内容？')) return;
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/admin/recycle-bin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '恢复失败');
      setLoaded(false); setRevision(n=>n+1);
    } catch (e) { setError(e instanceof Error ? e.message : '恢复失败'); }
    finally { setBusy(null); }
  }
  return <section className="space-y-8">
    <div>
      <h2 className="text-xl font-bold text-ink mb-2">回收站</h2>
      <p className="text-sm text-muted mb-4">删除的内容保留在这里，原始照片不会被清除。恢复照片或评论前，请先恢复所属旅程。</p>
      {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
      {!loaded && !error && <p className="text-sm text-muted">加载中…</p>}
      {loaded && rows.length === 0 && <p className="text-sm text-muted">本页没有待恢复的内容。</p>}
      {loaded && rows.map(row=><div key={row.id} className="flex justify-between gap-4 p-4 mb-2 border border-hairline rounded-xl">
        <div><p className="text-sm text-ink">{targets[row.target] || row.target} · {row.label}</p><p className="text-xs text-muted mt-1">{new Date(row.created_at).toLocaleString('zh-CN')}</p></div>
        <button disabled={busy !== null} onClick={()=>void restore(row.id)} className="text-sm text-primary disabled:opacity-50">{busy===row.id?'恢复中…':'恢复'}</button>
      </div>)}
      <div className="flex gap-4 mt-4 text-sm">
        <button disabled={page===0 || busy!==null} onClick={()=>{setLoaded(false);setPage(p=>p-1);}} className="disabled:opacity-40">上一页</button>
        <span>第 {page+1} 页</span>
        <button disabled={!loaded || rows.length<50 || busy!==null} onClick={()=>{setLoaded(false);setPage(p=>p+1);}} className="disabled:opacity-40">下一页</button>
        <button onClick={()=>{setLoaded(false);setRevision(n=>n+1);}}>刷新</button>
      </div>
    </div>
    <div><h2 className="text-xl font-bold text-ink mb-3">最近操作</h2><p className="text-sm text-muted mb-4">显示最近 100 条记录；完整修改前后内容保存在受保护的数据库审计表。</p>
      {audit.map(item=><div key={item.id} className="text-sm py-2 border-b border-hairline text-muted">{new Date(item.created_at).toLocaleString('zh-CN')} · {targets[item.target] || item.target} · {actions[item.action] || item.action}</div>)}
    </div>
  </section>;
}
