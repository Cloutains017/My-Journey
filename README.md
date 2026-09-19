# My Journey · 个人旅行日志

> 用脚步丈量世界，用地图记录每一段旅程。

一个个人旅行足迹全栈 Web 应用。首页以深色交互地图为主视觉，城市边界按评分染色；时间线按年份分组，旅程卡片如杂志内页排版；详情页封面图铺满半屏，支持瀑布流照片画廊、灯箱浏览和访客互动。

## 功能

**首页**
- 交互式地图（高德深色底图，自动降级 CARTO），城市区域按评分渲染，hover 发光，点击展示该城市所有旅程
- 统计栏：旅程总数、城市数、最近出行日期，数字动画入场
- 时间线按年份分组，卡片展示封面、标题、地点、评分徽章，桌面端左侧竖线导航

**旅程详情 (`/trip/[slug]`)**
- 杂志式封面铺满半屏，阅读进度条
- 正文支持段落/引用，首段首字下沉
- 照片画廊瀑布流 + 灯箱，键盘翻页，原始画质存储
- 访客投票：认同度（1-5）+ 想去程度（1-5），支持昵称和留言

**地图 (`/map`)** — 全屏自由浏览，底部旅程快捷列表

**后台 (`/admin`)** — 密码登录，旅程 CRUD，照片批量拖拽上传，封面设置，投票管理

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 数据库 | Supabase（PostgreSQL 17） |
| 照片存储 | Cloudflare R2（S3 兼容，10 GB 免费） |
| 地图 | Leaflet + react-leaflet + 高德底图 |
| 地理处理 | Turf.js（城市边界合并） |
| 坐标转换 | GCJ-02 ↔ WGS-84 |
| 部署 | Vercel |

## 本地开发

```bash
git clone https://github.com/Cloutains1221/My-Journey.git
cd My-Journey
npm install
npm run dev
```

访问 `http://localhost:3000`，后台入口 `http://localhost:3000/admin`。

## 环境变量

创建 `.env.local` 并填入以下配置：

```bash
# Supabase（数据库）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2（照片存储）
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_PUBLIC_URL=

# 管理后台
ADMIN_PASSWORD=
# 可选：独立的随机会话签名密钥（建议至少 32 字节）
ADMIN_SESSION_SECRET=
```

## 检查与安全说明

- 使用 Node.js 22.18+ 或 24 运行测试：`npm test`。
- 本机服务启动后，可运行接口回归测试（PowerShell）：`$env:ADMIN_TEST_BASE_URL="http://127.0.0.1:3007"; npm test`。使用 `.env.local` 的密码验证登录，其他请求只测试未授权状态，不修改数据。
- 代码检查：`npm run lint`；类型检查：`npx tsc --noEmit`；生产构建：`npm run build`。
- 后台使用带 HMAC 签名的 24 小时会话，服务端验证签名与有效期。旧版登录 Cookie 会失效，需要重新登录。
- `ADMIN_PASSWORD` 必须设置为强随机密码。可配置独立的 `ADMIN_SESSION_SECRET`；未配置时由管理密码派生签名密钥。修改密码或签名密钥后，已有会话失效。
- R2 与旧 Supabase 照片通过 Next.js Image 按显示尺寸加载；灯箱保留原图。图片来源严格限定为配置的存储地址，其他外链封面按原地址显示。修改存储地址后需要重新构建。

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（统计 + 地图 + 时间线）
│   ├── layout.tsx            # 根布局（导航 + 字体）
│   ├── map/page.tsx          # 全屏地图页
│   ├── trip/[slug]/page.tsx  # 旅程详情
│   ├── admin/                # 管理后台
│   └── api/
│       ├── admin/            # 管理 API
│       ├── votes/            # 投票 API
│       └── city-boundaries/  # 城市边界 GeoJSON
├── components/
│   ├── HeroMap.tsx           # 首页交互地图
│   ├── TripCard.tsx          # 旅程卡片
│   ├── PhotoGallery.tsx      # 瀑布流画廊 + 灯箱
│   ├── AgreementVote.tsx     # 认同度投票
│   ├── DesireVote.tsx        # 想去程度投票
│   ├── VisitorComments.tsx   # 访客评论
│   ├── RatingBadge.tsx       # 评级徽章
│   ├── ReadingProgress.tsx   # 阅读进度条
│   ├── YearNav.tsx           # 年份导航
│   └── Nav.tsx               # 导航栏
├── lib/
│   ├── types.ts              # 类型定义
│   ├── supabase.ts           # Supabase 客户端
│   ├── supabase-admin.ts     # Supabase 服务端客户端
│   ├── r2.ts                 # Cloudflare R2 上传/删除
│   ├── coords.ts             # GCJ-02 ↔ WGS-84
│   └── city-data.ts          # 城市边界匹配
scripts/
├── fetch-city-boundaries.ts  # 城市边界抓取
├── migrate-to-r2.ts          # 照片迁移至 R2
└── cleanup-supabase-storage.ts  # 清理旧存储
```

## 设计风格

温暖的编辑式排版：奶油色画布、珊瑚色强调、深色地图。衬线标题 + 无衬线正文。评级标签用网络俚语："顶级"、"人上人"、"夯"、"npc"、"拉完了"。

详见 [PRODUCT.md](PRODUCT.md)。

## 许可

MIT
