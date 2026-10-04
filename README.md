# My Journey · 个人旅行日志

> 用脚步丈量世界，用地图记录每一段旅程。

一个个人旅行足迹全栈 Web 应用。首页以交互地图呈现旅行与求学足迹，城市区域按评级染色；时间线按年份组织记录，支持关键词搜索和评级筛选；游记内页提供文字、照片画廊和访客互动。

线上站点：[www.cloutains.top](https://www.cloutains.top)

## 产品定位

这是 Cloutains 的个人旅行档案：用地图、时间线、照片和文字记录每一段旅程。它服务于安静地回看、阅读和互动，不提供旅行预订、攻略分发或社交动态功能。

界面以摄影旅行刊物的方式呈现内容，强调图片与阅读节奏。全站文字统一使用思源宋体，包括导航、标题、正文、日期、数字、表单控件、地图弹窗和后台界面。

## 功能

- 首页：交互地图、足迹统计、旅程卡片与求学记录；保留年份导览，支持按标题、城市和地点搜索，以及评级筛选。搜索状态保存在 URL 中，返回时间线时会保留；输入框在拼音组合输入结束后提交搜索词。
- 旅程详情：摄影封面、图文正文、阅读进度、返回顶部和上一篇／下一篇导航。
- 照片浏览：按相册分组，以原始宽高比展示照片；长相册每次显示 24 张，追加时保留已显示照片的位置。灯箱读取原图，支持键盘切换和关闭。
- 访客互动：“留下你的感受”统一提供五档认可度和心动指数，可只选其中一项，共享昵称与可选留言，选中评价后显示留言框。部分提交失败时保留内容、仅重试未保存项，也可只保留已成功的评价；访客回声按昵称合并两种评价并去重相同留言。游记封面首次显示评级时附简短含义，页尾可展开查看全部评级用语说明。
- 地图页：全屏浏览城市、相关旅程和求学足迹，可从游记内页直接定位。
- 管理后台：带限速的密码登录、旅程与求学记录管理、照片批量上传与分组、批量选择删除、封面设置、回收站恢复、操作记录和存储检查。
- 显示与动效：浅色／深色模式、卡片反馈、封面文字入场和新照片批次过渡；尊重系统的减少动态效果设置。

## 字体

使用与字体对照中相同的思源宋体字形：`Noto Serif SC`，由 `@fontsource-variable/noto-serif-sc@5.2.10` 提供。Next.js 在构建时打包字体文件，由网站自己提供，浏览器按 Unicode 字符范围加载需要的 WOFF2 分片，不依赖运行时字体 CDN。

正文与卡片标题使用常规字重 400，封面标题使用 500。正文在手机上为 17 px，较宽屏幕上为 18 px；完整字体来源及许可见 [字体说明](public/fonts/noto-serif/README.md) 和 [OFL 许可](public/fonts/noto-serif/LICENSE.txt)。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 16（App Router） |
| 界面 | React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 字体 | 自托管思源宋体，可变字重与 Unicode 分片 |
| 数据库 | Supabase（PostgreSQL） |
| 图片存储 | Cloudflare R2（S3 兼容） |
| 地图 | Leaflet 与高德底图 |
| 地理处理 | Turf.js |
| 部署 | Vercel |

## 本地开发

使用 Node.js 22.18+ 或 24。安装依赖后，先配置环境变量与数据库，再启动服务：

```powershell
git clone https://github.com/Cloutains017/My-Journey.git
cd My-Journey
npm ci
Copy-Item .env.example .env.local
```

填写 `.env.local` 中的实际配置；新数据库按下方“数据库初始化与迁移”准备完成后，运行：

```powershell
npm run dev
```

访问 `http://localhost:3000`；管理后台位于 `http://localhost:3000/admin`。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入项目实际配置：

```powershell
Copy-Item .env.example .env.local
```

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器端 Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 Supabase 密钥；不得暴露给浏览器 |
| `SUPABASE_DB_URL` | 仅本地正式恢复时使用的数据库直连或 Session pooler 地址，端口 5432；无需配置到 Vercel |
| `ADMIN_PASSWORD` | 管理后台密码 |
| `ADMIN_SESSION_SECRET` | 可选的独立会话签名密钥，建议随机生成至少 32 字节 |
| `CLOUDFLARE_*` | R2 账号、访问密钥、桶名和公开访问地址 |
| `R2_CORS_ALLOWED_ORIGINS` | 可选：覆盖默认的 R2 浏览器上传允许来源列表 |

修改 `ADMIN_PASSWORD` 或已配置的 `ADMIN_SESSION_SECRET` 并重新部署后，旧后台会话失效。请使用密码管理器生成独立的长密码。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地开发服务 |
| `npm run start` | 启动已构建的生产服务，需先运行 `npm run build` |
| `npm run lint` | 运行 ESLint |
| `npx tsc --noEmit` | 类型检查 |
| `npm test` | 运行测试 |
| `npm run build` | 创建生产构建 |
| `npm run design:check` | 扫描 `src` 中的设计问题 |
| `npm run city-boundaries:fetch` | 更新本地城市边界 GeoJSON |
| `npm run r2:stats` | 查看 R2 对象数量和用量 |
| `npm run r2:backfill-variants` | 统计旧照片缺少的列表图和头图；加 `-- --apply` 才会写入 R2 |
| `npm run r2:configure-cors` | 写入 R2 的浏览器上传 CORS 规则 |
| `npm run test:security-api` | 在本地临时数据库与 Next.js 服务上验证安全接口，不触碰正式数据 |
| `npm run backup:data` | 导出业务数据与 R2 图片对象至 Git 忽略的 `backups/`，生成校验清单 |
| `npm run backup:verify -- backups/<快照目录>` | 校验备份文件，并在内存数据库演练业务数据恢复 |
| `npm run backup:restore -- backups/<快照目录>` | 校验快照并预演恢复；加 `--apply --target-ref <项目ref>` 才会补回缺失记录 |

## 数据保护

完整实施记录见 [docs/security-plan.md](docs/security-plan.md)。当前项目已经具备以下保护：

- **登录防护**：登录次数由数据库原子计数；同一来源每 15 分钟最多 10 次，全站每 15 分钟最多 100 次，成功尝试也计数。限速或审计存储不可用时拒绝登录。
- **会话与请求保护**：后台 Cookie 经过签名，并设置 `HttpOnly`、生产环境 `Secure` 和 `SameSite=Strict`；写操作核对同源 `Origin` 并拒绝跨站 Fetch Metadata。修改 `ADMIN_PASSWORD` 或独立的 `ADMIN_SESSION_SECRET` 后重新部署会使旧会话失效。
- **数据库权限**：业务表启用 RLS；匿名和普通登录角色只有公开读取权限。回收站、登录限速与审计表仅服务端可访问，管理员 RPC 只授权 `service_role`。
- **回收与恢复**：删除旅程、照片和访客投票时，会在同一数据库事务中保存快照后移除公开记录。旅程快照包含关联照片和评论；恢复保留原 UUID，遇到冲突会整体取消，不覆盖现有数据。求学记录目前直接删除，不进入回收站。
- **操作审计**：旅程、照片、投票和城市边界表的新增、修改和删除由数据库触发器记录修改前后内容；登录成功与失败单独记录，但不保存密码、Cookie 或密钥。
- **上传防护**：服务端生成不可预测的 R2 对象路径；只接受允许的图片类型和大小，并在写入照片记录前确认对象存在且属于对应旅程。
- **备份校验**：本机备份包含旅程、照片、两类投票、城市边界、回收站、审计数据和 R2 原图，带 SHA-256 清单；校验脚本会在内存 PostgreSQL 中恢复业务表并检查计数与外键约束。当前备份与恢复脚本尚未覆盖求学记录表 `education`。

照片可逐张或批量移入回收站。若照片是当前封面，后台会同步清空封面引用。普通删除不会移除 R2 原图，因此仅移入回收站不等于私密擦除；回收站中的照片可在二次确认后永久删除，此操作会删除 R2 原图和回收站快照，无法恢复。

编辑旅程时，可在“旅程照片”区域新建、命名或排序分组，并在照片卡片上逐张选择分组；也可勾选多张照片，选择目标分组后点击“批量分组”。点击照片可预览原图，用左右箭头或键盘切换，按 Esc 关闭。完成后点击编辑区顶部固定的“保存全部”，旅程内容和照片分组会一起保存。未分组照片显示在最后；旧游记无需修改，仍按原照片墙展示。

“首页摘要”可单独填写卡片介绍，建议 40 到 80 个字，最多 120 个字；留空时继续显示正文开头。选择封面后，首页卡片、电脑封面和手机封面始终显示各自预览，可拖动照片、使用十字方向键或聚焦图片后按方向键调整，中央按钮恢复居中。电脑与手机取景独立保存；旧游记及旧备份在首次调整前保留原来的共用取景。更换封面会恢复居中；重选同一张封面保留设置。摘要与取景通过“保存全部”一起提交，只改变展示，不裁切或覆盖原图。新增字段随现有备份与游记回收快照保存。

备份使用本机 `.env.local` 只读导出，包含私人审计数据，不能提交 Git 或放到公开网盘。可传入上次完整快照目录复用校验相同的图片：`npm run backup:data -- backups/<上次快照目录>`。只有 `manifest.json` 中 `complete: true` 才表示完成。恢复命令默认只预演；显式指定 `--apply` 和目标项目后才补回缺失数据，R2 补回需另加 `--with-r2`。完整步骤见 [备份与恢复使用说明](docs/backup-restore.md)。

### 配置 R2 CORS

后台使用预签名链接让浏览器直接上传图片到 R2。默认允许本地 `http://localhost:3000`、`https://cloutains.top` 和 `https://www.cloutains.top`。如需增加或调整来源，可在 `.env.local` 中填写 `R2_CORS_ALLOWED_ORIGINS`，以逗号分隔每个确切来源，例如：

```env
R2_CORS_ALLOWED_ORIGINS=http://localhost:3000,https://cloutains.top,https://www.cloutains.top
```

然后运行：

```bash
npm run r2:configure-cors
```

此命令会覆盖目标 R2 桶现有的 CORS 规则。仅在需要新增或变更允许来源时运行；它不会在部署过程中自动执行。

## 验证与测试

- `npm test` 运行组件行为、数据处理、安全规则和备份恢复测试，并包含数据库不可用时的生产构建检查。未设置 `ADMIN_TEST_BASE_URL` 时，3 项需要本地服务的接口测试会跳过。
- `npm test` 内的构建检查会写入 `.next/`，应与 `npm run build` 顺序执行；如需预览实际旅程数据，在测试完成后重新运行 `npm run build`。
- 本机服务启动后，可额外运行接口回归测试。`ADMIN_TEST_BASE_URL` 只接受 `localhost` 或 `127.0.0.1`，端口应与实际本地服务一致：

  ```powershell
  $env:ADMIN_TEST_BASE_URL="http://127.0.0.1:3007"
  npm test
  ```

  测试使用 `.env.local` 的后台密码验证登录，会消耗登录尝试次数并写入登录审计；其余接口只验证未授权状态，不修改业务数据。完整删除/恢复测试使用 `test:security-api` 的隔离环境，运行前需关闭同目录中的其他 `next dev` 服务。

- 新上传的照片会保留 R2 原图，同时生成最长边 640 px 的列表图和 1920 px 的头图。照片墙、卡片及后台预览读取列表图，旅程头图读取较大版本，灯箱读取原图。图片不经过 Vercel Image Transformations；旧照片缺少变体时自动回退原图，外部封面仍按原地址展示。
- 批量上传逐张保存已完成的照片；中途失败时，已保存的照片会留在旅程中，后台会显示成功数量，可重新选择未完成的文件继续上传。
- 后台的“存储检查”会读取完整 R2 清单，对照照片、封面、游记正文和回收站，显示在用文件、回收站保留、遗留文件及各类图片的空间占用。未关联文件上传不足 15 分钟或时间未知时列为“等待确认”；检查只读，不执行批量删除。
- 上传失败会自动清理该张照片的原图与变体。断网、关页或登记响应丢失时，浏览器先保存清理记录；保持后台登录或下次在同一浏览器登录后，每分钟重试。结果不确定时等待 15 分钟，再确认数据库和所有历史回收站引用后清理，已登记的照片会保留。关闭后台期间不会重试；清除浏览器数据会丢失重试记录，仍可通过“存储检查”发现遗留文件。更改后台密码或签名密钥后，旧凭证转为人工核对提示。
- 旧照片可先运行 `npm run r2:backfill-variants` 查看缺少数量，再运行 `npm run r2:backfill-variants -- --apply` 补生成。脚本只处理当前旅程和封面引用的 R2 原图，只新增缺少的 WebP 对象；回收站照片恢复后可重跑。可先用 `-- --apply --limit 10` 小批量检查。新上传若浏览器无法解码原图或生成 WebP，会提示先将图片转换为 JPEG 或 PNG。

## 部署

项目部署在 Vercel，`main` 分支的推送会触发生产部署。将实际环境变量配置到 Vercel 的 Production 环境，发布前依次运行：

```powershell
npm run lint
npm test
npm run build
```

构建会预生成可读取到的旅程内页。数据库暂时不可用时构建仍可完成；因此发布前还要核对实际旅程数据，不能只看构建是否成功。部署完成后检查首页、旅程内页、地图定位、字体与图片加载；后台操作需登录后验证。

`.vercelignore` 排除本地截图和检测报告、备份、构建目录、依赖目录、环境文件及 TypeScript 缓存；这些本机文件不随手动部署上传。

### 数据库初始化与迁移

新项目先执行 [supabase/schema.sql](supabase/schema.sql)，再执行 [supabase/security.sql](supabase/security.sql)。当前初始化脚本已经包含照片分组、求学记录、权限和回收站永久删除 RPC；不要在新库上重复创建求学表。

已有项目先备份，再根据尚未应用的功能执行对应迁移：

| 功能 | 迁移 |
| --- | --- |
| 回收站照片永久删除 | `supabase/migrations/20260922_purge_recycled_photos.sql` |
| 照片分组 | `supabase/migrations/20260924_photo_groups.sql` |
| 求学记录 | `supabase/migrations/20260929_education.sql` |
| 求学表公开角色只读权限 | `supabase/migrations/20260929_education_read_only_grants.sql` |
| 首页摘要与封面取景 | `supabase/migrations/20261004144104_trip_presentation.sql` |
| 手机独立取景与固定预览 | `supabase/migrations/20261004162850_mobile_cover_framing.sql` |

首次启用数据保护功能时还需执行 `supabase/security.sql`。各环境分别确认迁移和权限后再发布依赖它们的后台；安全表仅向服务端开放，管理员 RPC 仅授权 `service_role`。

`R2_CORS_ALLOWED_ORIGINS` 仅被本地维护脚本读取，不需要配置为 Vercel 运行时环境变量；需要更改桶的 CORS 时，在本地执行相应命令即可。

## 项目结构

```text
src/
├── app/                     # 页面与 API 路由
├── components/              # 地图、旅程、投票和后台界面组件
└── lib/                     # 数据访问、认证、R2 和地理工具
scripts/
├── backup-data.mjs         # 数据及原图备份
├── verify-backup.mjs       # 校验与隔离恢复演练
├── restore-backup.mjs      # 本地补回数据库记录与可选 R2 对象
├── check-r2-stats.ts        # R2 用量检查
├── backfill-photo-variants.ts # 为旧照片补生成列表图和头图
├── fetch-city-boundaries.ts # 城市边界数据更新
└── setup-r2-cors.ts         # R2 浏览器上传 CORS 配置
supabase/schema.sql          # 数据库结构
supabase/security.sql        # 权限、限速、审计、回收站与恢复
public/data/city-boundaries.json # 城市边界静态数据
public/fonts/noto-serif/     # 当前字体来源说明与 OFL 许可
tests/                       # 接口、组件行为、数据库与备份恢复测试
docs/                        # 安全实施记录、备份与恢复使用说明
```

## 许可

MIT

字体另遵守 SIL Open Font License 1.1，许可随项目保存在 `public/fonts/noto-serif/LICENSE.txt`。
