"use client";

import { useState } from 'react';
import Link from 'next/link';
import type { StorageAudit } from '@/lib/storage-audit';

function size(bytes: number) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1000).toFixed(1)} KB`;
}

export default function StorageAdmin({ pendingCleanups, manualCleanups }: { pendingCleanups: number; manualCleanups: number }) {
  const [report, setReport] = useState<StorageAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  async function scan() {
    setLoading(true); setError(''); setReport(null); setPage(0);
    try {
      const response = await fetch('/api/admin/storage', { cache: 'no-store', signal: AbortSignal.timeout(75_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '存储检查失败');
      setReport(data);
    } catch (error) { setError(error instanceof Error ? error.message : '存储检查失败，请重试'); }
    finally { setLoading(false); }
  }
  const rows = report?.files.slice(page * 50, page * 50 + 50) ?? [];
  return <section className="max-w-5xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink">存储检查</h2>
        <p className="mt-2 text-sm text-muted">核对照片、封面、游记正文和回收站引用，找出留在 R2 的未关联文件。</p>
      </div>
      <button type="button" onClick={() => void scan()} disabled={loading} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{loading ? '正在检查…' : report ? '重新检查' : '开始检查'}</button>
    </div>
    <p className="text-sm text-muted">上传不足 15 分钟或时间未知的未关联文件会列为“等待确认”。检查只读取文件信息。</p>
    {pendingCleanups > 0 && <p role="status" className="rounded-xl border border-hairline p-4 text-sm text-muted">有 {pendingCleanups} 次未完成上传等待核对。保持后台登录，系统每分钟重试清理；无法确认保存结果时会先等待 15 分钟。</p>}
    {manualCleanups > 0 && <p role="alert" className="rounded-xl border border-hairline p-4 text-sm text-red-600">有 {manualCleanups} 次上传的清理凭证已失效（例如后台密码已更改），请点击“开始检查”核对遗留文件。</p>}
    {loading && <p role="status" className="text-sm text-muted">正在读取完整存储清单和数据库引用，请稍候…</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {report && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['全部文件', report.total], ['在用文件', report.active], ['回收站保留', report.recycled], ['遗留文件', report.orphan], ['等待确认', report.recent],
        ].map(([label, value]) => {
          const usage = value as StorageAudit['total'];
          return <div key={String(label)} className="rounded-xl border border-hairline bg-surface-card p-4">
            <p className="text-xs text-muted">{String(label)}</p><p className="mt-2 text-2xl font-semibold text-ink tabular-nums">{usage.count.toLocaleString()}</p><p className="mt-1 text-sm text-muted">{size(usage.bytes)}</p>
          </div>;
        })}
      </div>
      <p className="text-xs text-muted">检查时间：{new Date(report.checkedAt).toLocaleString('zh-CN')} · 原图 {size(report.categories.original.bytes)} · 大图 {size(report.categories.hero.bytes)} · 缩略图 {size(report.categories.thumb.bytes)} · 其他 {size(report.categories.other.bytes)}</p>
      {report.files.length === 0 ? <p role="status" className="rounded-xl border border-hairline bg-surface-card p-6 text-sm text-accent-teal">检查完成，没有发现未关联文件。</p> : <>
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-card text-muted"><tr><th className="p-3 font-medium">所属旅程 / 文件</th><th className="p-3 font-medium whitespace-nowrap">大小</th><th className="p-3 font-medium whitespace-nowrap">状态</th></tr></thead>
            <tbody>{rows.map(file => <tr key={file.key} className="border-t border-hairline-soft">
              <td className="p-3 min-w-64">{file.tripSlug ? <Link className="text-primary" href={`/trip/${file.tripSlug}`}>{file.tripTitle}</Link> : <span className="text-ink">{file.tripTitle}</span>}<p className="mt-1 break-all text-xs text-muted">{file.key}</p><p className="mt-1 text-xs text-muted-soft">{file.lastModified ? new Date(file.lastModified).toLocaleString('zh-CN') : '上传时间未知'}</p></td>
              <td className="p-3 whitespace-nowrap text-muted tabular-nums">{size(file.size)}</td>
              <td className={`p-3 whitespace-nowrap ${file.status === 'orphan' ? 'text-red-600' : 'text-muted'}`}>{file.status === 'orphan' ? '遗留文件' : '等待确认'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)} className="disabled:opacity-40">上一页</button><span>第 {page + 1} / {Math.ceil(report.files.length / 50)} 页 · 共 {report.files.length} 个未关联文件</span><button type="button" disabled={(page + 1) * 50 >= report.files.length} onClick={() => setPage(value => value + 1)} className="disabled:opacity-40">下一页</button></div>
      </>}
    </>}
  </section>;
}
