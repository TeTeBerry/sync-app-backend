# Sync App Backend

NestJS 后端：组队活动、AI 对话 WebSocket、四 Agent 发帖闭环、Chroma 活动/画像 RAG、MongoDB、Redis 热度。

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | NestJS 10（Node ≥ 18.18，Mongoose 7） |
| AI | 混元文本（`HUNYUAN_API_KEY`）+ 千问 VL（`QWEN_API_KEY`）；两把 Key 分工 |
| Agent | TextParse / ImageParse / Risk（`src/ai/agents/`） |
| 知识库 | Chroma（`sync_knowledge` + `sync_user_profiles`） |
| 存储 | MongoDB |
| 缓存 | Redis（热度，可选） |
| 通信 | WebSocket（`ws://<host>/api/ai/chat/ws`） |

架构说明：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
LLM 配置：[docs/LLM.md](./docs/LLM.md)（混元文本 + 千问 VL）  
改造清单：[docs/BACKEND-REFACTOR-CHECKLIST.md](./docs/BACKEND-REFACTOR-CHECKLIST.md)  
Nest/Mongoose 升级：[docs/UPGRADE-NEST-MONGOOSE.md](./docs/UPGRADE-NEST-MONGOOSE.md)

## 快速开始

```bash
cd sync-app-backend
cp .env.example .env
# 编辑 .env：MONGODB_URI、HUNYUAN_API_KEY（文本）、QWEN_API_KEY（VL）

# 推荐：MongoDB + Redis（Docker）+ NestJS
npm run dev:all
```

分步：

```bash
npm run infra:up      # mongo + redis
npm run infra:chroma  # optional: Chroma on :8000 (profile chroma)
npm run wait:mongo
npm run start:dev
```

国内 Docker 拉取失败：`npm run infra:up:cn`

### 云服务器 Docker 部署

`.env.production` **不会随 git 上传**，须在服务器上单独创建：

```bash
cd ~/sync-app-backend
cp .env.example .env.production   # 或 scp 本机已填好的文件
nano .env.production              # WECHAT_MINI_APP_ID、JWT_SECRET、QWEN_API_KEY、HUNYUAN_API_KEY 等

sudo docker compose up -d --build
sudo docker compose exec app printenv WECHAT_MINI_APP_ID   # 应有 wx...
sudo docker compose exec app printenv REDIS_URL            # redis://redis:6379
```

`printenv` 为空 → 服务器上没有 `.env.production` 或文件里未写对应变量。  
无 `docker` 权限时用 `sudo`；长期可把用户加入 `docker` 组后重新登录 SSH。

Compose 已为 `app` 注入 `MONGODB_URI`、`REDIS_URL=redis://redis:6379`、`SEED_DEMO_DATA=false`（生产不写 demo 帖/评论/行程 lineup 等）。活动目录 seed 仍会 upsert。

**Chroma（可选 RAG）**：

```bash
# .env.production 增加：
# CHROMA_URL=http://chroma:8000

sudo docker compose --profile chroma up -d --build
```

本地非 Docker：`npm run infra:chroma`，`CHROMA_URL=http://localhost:8000`。

服务默认：`http://localhost:3000/api`

## 质量检查

```bash
npm run check   # typecheck + lint + format:check + unit tests（含 contract）
```

PR / `main` 推送由 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) 自动执行 `check` + `nest build`。  
`npm install` 后启用 **husky** + **lint-staged**（pre-commit 仅格式化/修复 staged 文件）。  
同级工作区一键检查：`../npm run check:all`（见 [`../CONTRIBUTING.md`](../CONTRIBUTING.md)）。  
详见 [`test/README.md`](./test/README.md)。

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 端口，默认 3000 |
| `MONGODB_URI` | MongoDB 连接串 |
| `REDIS_URL` | Redis（空则跳过，热度用 Mongo 兜底） |
| `HUNYUAN_API_KEY` | 混元 TokenHub Key（**文本必填**）；JSON/Agent 走 `hy3-preview` 等 |
| `HUNYUAN_TEXT_MODEL` | 混元文本模型，默认 `hy3-preview` |
| `QWEN_API_KEY` | 千问 DashScope Key（**VL 必填**）；仅手环/识图，不参与文本 |
| `QWEN_VL_MODEL` | 视觉模型，默认 `qwen-vl-plus` |
| `CHROMA_URL` | Chroma HTTP 基址，如 `http://localhost:8000`（`npm run infra:chroma`）；空则 RAG 降级 Mongo/规则 |
| `CHROMA_COLLECTION` | 活动知识库，默认 `sync_knowledge` |
| `CHROMA_PROFILES_COLLECTION` | 用户画像向量，默认 `sync_user_profiles` |
| `JWT_SECRET` / `AUTH_MODE` | 登录与 JWT（见 [docs/AUTH.md](./docs/AUTH.md)） |
| `AMAP_KEY` | AI 出行攻略 — 高德 Web 服务 Key（酒店/停车/夜宵/路线） |
| `CLOUDBASE_ENV_ID` | 校验小程序提交的 `cloud://` 云存储 fileID |
| `AUTH_ALLOW_DEMO` | 默认 `false`；本地无登录 H5 可设 `true` |

完整示例见 [.env.example](./.env.example)。LLM 分工见 [docs/LLM.md](./docs/LLM.md)。鉴权说明：[docs/AUTH.md](./docs/AUTH.md)。

## 主要接口

### AI 流式对话（WebSocket）

连接：`ws://localhost:3000/api/ai/chat/ws`（生产使用 `wss://` + 合法域名）

1. 客户端发送 `connect`：`{ "type": "connect", "sessionId?", "activityLegacyId?" }`
2. 服务端回复 `connected`
3. 客户端发送 `send`：`messages`、`userId`、`userName`、`activityLegacyId`；图片字段为 **`cloud://` fileID**（小程序 `wx.cloud.uploadFile` 后提交）；本地 dev 可传 `http://…/uploads/…`；不支持 data URL / 外链
4. 服务端推送 JSON 帧：`delta`、`message_complete`、`post_created`、`existing_post`、`activity_recommendation`、`suggested_replies`、`conversation_patch`、`done`、`error`

- `post_created`：AI 闭环发帖成功
- 审核拒绝：仅 `delta`（文案含「帖子暂未发布」），无 `post_created`

### 业务 REST（节选）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/home` | 首页（热度 + 活动列表） |
| GET | `/api/activities` | 活动列表 |
| GET | `/api/activities/:legacyId` | 活动详情 |
| POST/DELETE | `/api/activities/:legacyId/register` | 活动报名 / 取消 |
| GET/POST/PATCH/DELETE | `/api/posts`… | 帖子 CRUD + 点赞/评论 |
| POST | `/api/auth/logout` | 退出登录（Bearer；递增 `tokenVersion` 吊销旧 JWT） |
| GET/PATCH | `/api/users/me` | 当前用户资料 |
| GET | `/api/profile` | 个人页 BFF 摘要 |
| GET | `/api/profile/activities` | 个人活动列表 |
| GET | `/api/profile/posts` | 个人帖子列表 |
| WS | `/api/ai/chat/ws` | AI 对话（主通道） |
| GET | `/api/chat/sessions/:id` | 会话历史 |

完整契约：`sync-app/docs/API.md`

**身份（当前）**：全局 `JwtAuthGuard` + `RequestActor`；demo 可用 Query `userId`（`AUTH_ALLOW_DEMO=true`）。详见 [`docs/AUTH.md`](./docs/AUTH.md)。

## REST 冒烟

后端已启动时，一键跑主路径 REST（见 `scripts/smoke-api.mjs`）：

```bash
npm run smoke:api        # 默认 http://localhost:3000/api，活动 legacyId=4
npm run smoke:api:wait   # 等待 :3000 就绪后再跑
```

环境变量：`SMOKE_API_BASE`、`SMOKE_ACTIVITY_ID`、`SMOKE_USER_ID`、`SMOKE_AUTHOR_NAME`。说明见 `test/README.md`。

## 测试数据重置

```bash
npm run db:reset
```

清空 MongoDB `chats` 集合（AI 会话历史），保留活动 / 帖子等种子数据。重置后前端需清除 `sessionStorage` 键 `sync_ai_session`（或开无痕窗口）。

各模块 `OnModuleInit` 会在集合为空时自动 seed：

| 集合 | 来源 |
|------|------|
| activities | `ActivityService` |
| posts | `PostService` |
| activity registrations | `ActivityRegistrationSeedService` |
| users (demo profile) | `UserService` |
| Chroma 知识库 | `ChromaService.seedIfEmpty` |

## 活动实时资讯 `live-info`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/activities/:legacyId/live-info` | 快照：`zones` / `viewer` / `summary` / `certCount` / `feed`；Query 可选 `zoneTag`、`categoryId`、`certifiedOnly=true`（按区域/类目/作者当日仍「我在现场」筛选） |

UGC 图片：小程序 `wx.cloud.uploadFile` → 客户端提交 **`cloud://` fileID**（路径 `ugc/posts/…`）；后端校验并落库，展示由客户端 `getTempFileURL` 完成。

UGC 文本（帖/评/现场资讯/AI 用户消息/资料/举报说明等）落库前走微信 `msg_sec_check`（同 `WECHAT_CONTENT_SECURITY_ENABLED` 开关）。

| POST | `.../live-info/wristband` | 提交 `{ imageUrl }`（`cloud://` fileID 或本地 dev `/uploads/` URL）；`cloud://` 跳过服务端拉图与 VL 审核；本地 URL 先查重复再 **Qwen-VL**；通过则当日认证 |
| DELETE | `.../live-info/wristband` | 清除当日认证 |
| POST | `.../live-info/updates` | 发布 `{ zoneTag, ratings: [{ categoryId, score }], remark? }`（`zoneTag` 须为活动 `liveInfoZones` 中的 id；5 分钟冷却、每小时 8 条上限、24h 内同用户同内容指纹不可重复） |
| POST | `.../live-info/updates/:updateId/like` | 点赞切换 |

举报 `GET /api/reports/status` 响应含 `reviewStatus`：`pending` | `acknowledged`（对方账号被风控限制时自动视为已受理）。

Query：`userId`、`authorName`（与其它活动 API 一致）。评分类目含 `entry_crowd` / `toilet_queue` / `water_queue` / `smoke_drink` / `sound_level`（音量听感）/ `stage_view`（视野）。报告约 90 分钟过期；发布需当日已认证手环。`feed` 条目含 `zoneTag`、`zoneLabel`、`authorOnSiteVerified`（快照时刻作者仍认证则为 true）。`feed` 按新鲜度 + 点赞 + 备注加权排序（非纯 `createdAt`）。当日手环认证用户在同活动的帖子上带 `authorOnSiteVerified: true`（`OnSiteIdentityService`）。Demo 活动 `legacyId=4` 配置 A/B/卡座区域并种子现场报告。

## 专属电音行程 `itinerary`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/activities/:legacyId/itinerary/schedule` | 演出表 + DJ 列表；Query `dateKey?`、`selectedDjIds?`（逗号分隔）返回 `conflicts` |
| POST | `/api/activities/:legacyId/itinerary/generate` | Body `{ selectedDjIds, dateKey? }` → `{ itinerary, conflicts, cached }`（按 Mongo 官方排期规则生成） |
| POST | `/api/activities/:legacyId/itinerary/save` | 持久化用户行程 |
| GET | `/api/activities/:legacyId/itinerary/saved` | 读取已保存行程 |

Demo：`legacyId=4`（风暴电音节）启动时 seed **2026-06-13/14 深圳站完整阵容**（`itinerary.seed.ts`）；重启后端可 upsert 并剔除旧 demo 艺人。Redis 缓存排期/生成结果、生成锁与频率限制（`REDIS_URL` 空则内存兜底）。生成逻辑见 `buildFallbackItinerary`（所选 DJ 官方时段 + 出发提醒，不调大模型）。

## AI 出行攻略 `travel-guide`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/activities/:legacyId/travel-guide/generate` | 生成攻略（出发地、人数、预算档、是否自驾等） |
| GET | `/api/travel-guide/place-suggestions` | 出发地输入提示（高德 inputtips + 本地城市库） |

酒店、停车、夜宵均来自 **高德周边检索**（`place/around`），不再使用运营维护酒店清单。详见 [docs/TRAVEL_GUIDE_MAP.md](./docs/TRAVEL_GUIDE_MAP.md)。

## 前端对接

`sync-app/.env`：

```env
TARO_APP_API_BASE_URL=/api
# 小程序直连后端示例（替换为局域网 IP）：
TARO_APP_AI_CHAT_WS_URL=ws://127.0.0.1:3000/api/ai/chat/ws
# UGC 图片（CloudBase 云存储直传）：
TARO_APP_CLOUDBASE_ENV_ID=sync-prd-xxxx
```

H5 devServer 将 `/api`（含 WebSocket 升级）代理到 `http://localhost:3000`。契约详见 `sync-app/docs/API.md`。

> **说明**：AI 对话仅走 **WebSocket** `ws(s)://<host>/api/ai/chat/ws`，无 `POST /api/ai/chat` HTTP/SSE 端点。历史文档中的 SSE 指同一套 `AiStreamEvent` 载荷，经 WS JSON 帧下发。

## 运维与监控

| 检查项 | 方式 |
|--------|------|
| 进程与基础设施 | `GET /api/health` → `mongodb` / `redis` / `chroma` |
| AI 传输通道 | 同上响应中的 `ai.transport` = `websocket`，`ai.path` = `/api/ai/chat/ws` |
| 启动日志 | `✅ AI WebSocket: ws://localhost:<port>/api/ai/chat/ws`（`main.ts` / `AiChatWsServer`） |
| 单轮 AI 日志 | 结构化 `logAiTurn`（`event=turn_start|turn_complete|turn_error`），请求头 `X-Request-Id` 贯穿 WS 与 REST |

### 图片与云托管

| 变量 | 说明 |
|------|------|
| `CLOUDBASE_RUN_HOST` | **云托管**公网域名（文档用；如 `https://sync-prd-xxxx.tcloudbaseapp.com`），对应前端 `TARO_APP_API_BASE_URL` + `/api` |
| `CLOUDBASE_ENV_ID` | CloudBase 环境 ID；校验客户端 `cloud://` fileID |
| `ENABLE_LOCAL_UPLOADS` | 生产默认 `false`；仅本地 Nest 联调时设 `true` |
| `UPLOAD_DIR` / `UPLOAD_PUBLIC_BASE_URL` | 配合 `ENABLE_LOCAL_UPLOADS=true` 的本地静态 `/uploads`（云托管容器无持久盘，生产勿用） |

生产：**小程序直传 CloudBase 云存储** → 后端存 `cloud://` fileID；API 走**云托管** HTTPS，不依赖 CVM 静态目录。

### 手环 AI 审核

手环走 **DashScope VL**（`invokeVisionJson`），与文本提供商无关；混合部署时仍需 `QWEN_API_KEY`。

| 变量 | 说明 |
|------|------|
| `QWEN_API_KEY` | VL 必填（`QWEN_VL_MODEL`） |
| `QWEN_VL_MODEL` | 默认 `qwen-vl-plus` |
| `WRISTBAND_VERIFY_ENABLED` | 默认随 API Key 开启；`false` 关闭 |
| `WRISTBAND_VERIFY_MIN_CONFIDENCE` | 通过阈值，默认 `0.72` |
| `WRISTBAND_AI_SKIP` | `true` 时跳过审核（仅本地调试） |

`viewer.certStatus`：`none` \| `approved` \| `rejected`；拒绝时带 `rejectReason`。

活动帖分页：`GET /api/posts?activityLegacyId=&limit=10&cursor=&anchorPostId=` → `{ items, nextCursor?, hasMore }`。

## 常见问题

### MongoDB 连接失败

1. `docker compose ps` 确认 mongo 为 healthy  
2. `.env` 中 `MONGODB_URI` 与 compose 端口一致  
3. 使用 `npm run dev:all` 而非单独 `start:dev`

### Chroma

```bash
npm run infra:chroma   # docker compose --profile chroma up -d chroma  → :8000
curl -s http://localhost:8000/api/v1/heartbeat
```

`.env` 设置 `CHROMA_URL=http://localhost:8000`。未配置或连不上时活动知识库 RAG 与用户画像向量自动降级；专属行程仍以 Mongo 官方演出表为准。后端健康：`GET /api/health` → `chroma: enabled|disabled|circuitOpen`。
