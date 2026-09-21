# My Journey · 个人旅行日志

> 用脚步丈量世界，用地图记录每一段旅程。

一个个人旅行足迹全栈 Web 应用。首页以深色交互地图呈现足迹，城市区域按评分染色；时间线按年份组织旅程；详情页提供图文、照片画廊和访客互动。

线上站点：[www.cloutains.top](https://www.cloutains.top)

## 产品定位

这是 Cloutains 的个人旅行档案：用地图、时间线、照片和文字记录每一段旅程。它服务于安静地回看、阅读和互动，不提供旅行预订、攻略分发或社交动态功能。

界面以温暖、克制的编辑式排版呈现内容，强调地图、照片与文字本身。完整视觉规范见 [DESIGN.md](DESIGN.md)。

## 功能

- 首页：交互地图、足迹统计、按年份排列的旅程时间线。
- 旅程详情：杂志式封面、阅读进度、瀑布流照片画廊与灯箱浏览。
- 访客互动：五档认可度、五档心动指数、昵称和留言。
- 地图页：全屏浏览城市与相关旅程。
- 管理后台：带限速的密码登录、旅程管理、照片批量上传、封面设置、回收站恢复与操作记录。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 数据库 | Supabase（PostgreSQL） |
| 图片存储 | Cloudflare R2（S3 兼容） |
| 地图 | Leaflet、react-leaflet 与高德底图 |
| 地理处理 | Turf.js |
| 部署 | Vercel |

## 本地开发

```bash
git clone https://github.com/Cloutains017/My-Journey.git
cd My-Journey
npm install
npm run dev
```

访问 `http://localhost:3000`；管理后台位于 `http://localhost:3000/admin`。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入项目实际配置：

```bash
copy .env.example .env.local
```

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器端 Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 Supabase 密钥；不得暴露给浏览器 |
| `ADMIN_PASSWORD` | 管理后台密码 |
| `ADMIN_SESSION_SECRET` | 可选的独立会话签名密钥，建议随机生成至少 32 字节 |
| `CLOUDFLARE_*` | R2 账号、访问密钥、桶名和公开访问地址 |
| `R2_CORS_ALLOWED_ORIGINS` | 可选：覆盖默认的 R2 浏览器上传允许来源列表 |

修改 `ADMIN_PASSWORD` 或 `ADMIN_SESSION_SECRET` 并重新部署后，旧后台会话失效。请使用密码管理器生成独立的长密码；生产环境建议同时配置独立会话密钥。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地开发服务 |
| `npm run lint` | 运行 ESLint |
| `npx tsc --noEmit` | 类型检查 |
| `npm test` | 运行测试 |
| `npm run build` | 创建生产构建 |
| `npm run design:check` | 扫描 `src` 中的设计问题 |
| `npm run city-boundaries:fetch` | 更新本地城市边界 GeoJSON |
| `npm run r2:stats` | 查看 R2 对象数量和用量 |
| `npm run r2:configure-cors` | 写入 R2 的浏览器上传 CORS 规则 |
| `npm run test:security-api` | 在本地临时数据库与 Next.js 服务上验证安全接口，不触碰正式数据 |
| `npm run backup:data` | 导出业务数据与 R2 原图至 Git 忽略的 `backups/`，生成校验清单 |
| `npm run backup:verify -- backups/<快照目录>` | 校验备份文件，并在内存数据库演练业务数据恢复 |

## 数据保护

完整方案和验收记录见 [docs/security-plan.md](docs/security-plan.md)。后台删除会在同一事务内保存快照并移除公开展示记录，R2 原图保留。旅程快照包含关联照片和评论；在“回收站与操作记录”恢复时遇到冲突会整体取消，不覆盖已有数据。后台没有永久清空入口，回收站不会自动过期。

删除不是私密擦除：已知原图地址仍可能访问照片。若需要永久移除敏感照片，应由所有者在保留备份后单独处理存储对象和缓存。

登录限制为每个来源每 15 分钟 10 次尝试、全站每 15 分钟 100 次，包含成功登录。数据库不可用时拒绝登录和回收站操作。登录日志不保存密码、Cookie 或密钥；业务修改前后的快照保存在仅服务端可读的审计表。

备份使用本机 `.env.local` 只读导出，包含私人审计数据，不能提交 Git 或放到公开网盘。可传入上次完整快照目录复用校验相同的图片：`npm run backup:data -- backups/<上次快照目录>`。只有 `manifest.json` 中 `complete: true` 才表示完成；该导出不是数据库一致性快照，不替代定期 `pg_dump` 和异地备份。回收站、备份及完整审计会占用额外空间。

恢复正式数据前先运行 `backup:verify`，然后在隔离项目内核对；按旅程、照片、评论的顺序恢复记录，按 manifest 中的 key 恢复 R2 文件。不要直接覆盖已有正式数据。

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

- 使用 Node.js 22.18+ 或 24。
- 本机服务启动后，可运行接口回归测试：

  ```powershell
  $env:ADMIN_TEST_BASE_URL="http://127.0.0.1:3007"
  npm test
  ```

  测试使用 `.env.local` 的后台密码验证登录，会消耗登录尝试次数并写入登录审计；其余接口只验证未授权状态，不修改业务数据。完整删除/恢复测试使用 `test:security-api` 的隔离环境。

- R2 图片经 Next.js Image 按显示尺寸加载，灯箱保留原图。外部封面地址按原地址展示。

## 部署

项目部署在 Vercel。将环境变量同步到 Vercel 的 Production 环境后，从 `main` 分支推送即可触发部署。部署后通过线上站点检查首页、旅程详情、后台登录与图片上传。

首次安装数据保护功能必须先备份，再在 Supabase 执行 `supabase/security.sql`，核对权限后部署应用。新项目先执行 `supabase/schema.sql` 再执行安全脚本。安全表不向匿名或普通登录用户开放；新增管理员 RPC 仅授权 `service_role`。数据库迁移成功前不要发布依赖它的新后台，否则登录和回收站操作会安全地拒绝执行。

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
├── check-r2-stats.ts        # R2 用量检查
├── fetch-city-boundaries.ts # 城市边界数据更新
└── setup-r2-cors.ts         # R2 浏览器上传 CORS 配置
supabase/schema.sql          # 数据库结构
supabase/security.sql        # 权限、限速、审计、回收站与恢复
public/data/city-boundaries.json # 城市边界静态数据
tests/                       # 接口与组件行为测试
DESIGN.md                    # 视觉设计规范
```

## 许可

MIT
