# 本地备份与恢复使用说明

这套命令在你的电脑上运行。备份会保存 Supabase 数据表和 R2 对象到 `backups/`；恢复只补回缺失的数据库记录和可选的 R2 对象。已有但内容不同的记录会使数据库事务回滚；已有但大小或 ETag 不同的 R2 对象会使恢复停止。

## 1. 准备

安装依赖：`npm install`。将 `.env.example` 复制为 `.env.local`，填写 Supabase URL、服务端密钥和 R2 配置。`.env.local`、`backups/` 都被 Git 忽略。备份包含旅程、照片、互动数据、回收站、审计数据和图片，请将快照复制到自己控制的离线位置，并保护其访问权限。

运行正式数据库恢复时，还需在本机 `.env.local` 填写 `SUPABASE_DB_URL`。在 Supabase 项目的 **Connect** 面板复制数据库连接字符串，可选 Direct connection 或 Session pooler，使用端口 `5432`、数据库 `postgres`，填入真实数据库密码。请勿使用 Transaction pooler 的 `6543` 端口。此变量只供本地恢复命令使用，不需要添加到 Vercel，也不要提交 Git。

项目 ref 是项目 URL 中 `.supabase.co` 前的 20 位字符串。例如 `https://abcdefghijklmnopqrst.supabase.co` 的 ref 为 `abcdefghijklmnopqrst`。

## 2. 保存快照

```powershell
npm run backup:data
```

命令会在 `backups/` 下创建带时间戳的目录。它导出表和 R2 对象，逐文件计算 SHA-256，并在内存数据库中检查业务表可恢复；成功后 `manifest.json` 的 `complete` 为 `true`。如果上次快照仍在本机，可复用内容相同的 R2 文件，以减少下载：

```powershell
npm run backup:data -- backups/<上次快照目录>
```

数据库表通过 API 顺序导出。编辑期间可能产生前后时间点不一致的数据；建议在无人编辑时备份。命令检查外键，但不能证明所有表来自同一瞬间。

## 3. 检查快照与恢复预演

```powershell
npm run backup:verify -- backups/<快照目录>
npm run backup:restore -- backups/<快照目录>
```

两条命令都会校验文件哈希、记录数量，并把业务数据放进内存 PostgreSQL 检查。第二条是恢复命令的默认预演模式，不连接或修改线上数据库及 R2。查看输出中的表记录数和图片数，再进行实际恢复。

## 4. 实际恢复

先确认 `.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_DB_URL` 和 R2 凭据指向你要恢复的项目。最好先保存一份当前状态的新快照。然后执行：

```powershell
# 仅补回数据库中缺失的记录
npm run backup:restore -- backups/<快照目录> --apply --target-ref <项目ref>

# 若 R2 图片也已丢失，先补回缺失图片，再补回数据库记录
npm run backup:restore -- backups/<快照目录> --apply --target-ref <项目ref> --with-r2
```

数据库恢复会在单个事务中按关联顺序写入。已存在且内容一致的记录会跳过；如果同 ID 记录已被修改，命令报错并回滚本次数据库写入。它不会删除现有数据，也不会把已有内容重置为旧快照。R2 图片仅补传缺失对象，上传先于数据库事务；如果数据库步骤失败，刚补传的图片会保留在 R2，可修正问题后重跑。重复执行不会重复插入相同记录。

**2026-09-21 等旧快照**没有来源项目标识。确认它确实来自目标项目后，在实际恢复命令末尾额外加 `--allow-legacy-source`。新快照会记录来源 Supabase 主机和 R2 桶，目标不匹配时命令会拒绝执行。

如果目标库缺少当前项目的表或迁移，先按 README 的数据库部署说明建立结构，再恢复。已有行内容冲突、快照文件校验失败或目标身份不匹配时，不要修改快照文件来绕过检查；先核对目标和数据差异。

## 5. 恢复后核对

查看命令显示的每张表“补回”和“已存在”数量。登录管理后台核对旅程、照片、分组、回收站和操作记录，并在前台打开几个旅程检查图片。若图片仍缺失，使用带 `--with-r2` 的命令补回对象。恢复完成后再创建一份新快照。

备份只能恢复快照保存时已有的内容。快照之后新增、又被删除的内容不在该快照里。请定期手动运行备份并将副本保存在项目目录以外。
