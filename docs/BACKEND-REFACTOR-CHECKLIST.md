# 后端改造 Checklist

> 目标：Gateway + User / Activity / Partner / AiAssistant + Agent + MongoDB/Chroma/Redis  
> 前端对照：`sync-app/docs/FRONTEND-REFACTOR-CHECKLIST.md`  
> 架构快照：`docs/ARCHITECTURE.md`  
> **策略**：H5 业务先行；登录 / JWT **整段后置**。

---

## 进度总览（2025-05 更新）

| 阶段 | 主题 | 状态 |
|------|------|------|
| P1 | 四模块读 API + 活动 | ✅ 完成 |
| P2 | Partner 写操作与互动 | ✅ 完成 |
| P3 | 四 Agent + AI 发帖闭环 | ✅ 完成 |
| P4 | Redis + Chroma 帖子向量 | ✅ 完成 |
| P5 | 文档 + BFF 清理 | ✅ 完成 |
| P0-H5 | Dev JWT + Guard | ⬜ 登录之后 |
| P0-Wx | 微信登录 | ⬜ 更晚 |

---

## 当前执行顺序

| 顺序 | 阶段 | 身份方式 |
|------|------|----------|
| ~~1–4~~ | P1–P4 业务 | Query `userId`/`authorName` + `demo-owner.util` |
| **5** | **P5** 文档 / 可选 BFF 瘦身 | 同上 |
| **6** | **P0-H5** | Bearer JWT |
| **7** | **P0-Wx** | Bearer JWT |

---

## 现状快照

### 已实现

- **PartnerModule**（`modules/partner/`）：`POST/PATCH/DELETE /posts`；`POST .../like|comments|applications`
- **Schema**：`post-like`、`post-comment`、`post-application`
- **AiModule**：SSE；`PostIntentService` 编排四 Agent
- **Agents**：`text-parse` / `image-parse` / `match` / `risk`（`src/ai/agents/`）
- **Chroma**：`sync_knowledge` + `sync_posts`（按活动 metadata 过滤）
- **Redis**：`HomeService` 热度缓存（graceful degrade）
- **SSE**：`post_created`；审核拒绝 → `delta` 文案（非 `error`）

### 未实现 / 延后

- `AuthModule`、`JwtAuthGuard`、`POST /auth/*`
- ~~ActivityRegistration 物理迁入 ActivityModule~~ ✅ `activity/registration/`
- ~~`PartnerModule` 目录 rename~~ ✅ `modules/partner/`
- `ALL_AGENT_TOOLS` 注册进 `AgentRuntimeService`（发帖走独立编排，非必须）
- 生产限流、关闭 demo Query

---

## P1 — 四模块（部分完成）

### ActivityModule ✅ 读

- [x] `GET /activities`、`/match`、`/:legacyId`
- [x] `POST/DELETE /activities/:legacyId/register`
- [x] Registration 从 `profile/` 迁入 `activity/registration/`

### UserModule

- [x] `GET/PATCH /users/me`
- [x] Demo seed / health

### PartnerModule ✅ 核心

- [x] 帖子 CRUD + 互动 API
- [x] 创建时 Chroma upsert；删帖删向量
- [x] 目录 `modules/partner/`（`PartnerModule` / `PartnerRepositoryModule` / `PartnerWriteModule`）

### AiAssistantModule ✅ 核心

- [x] `POST /ai/chat` SSE
- [x] `ChatModule` 会话持久化
- [x] AI 注入 `PostService.createPost`，不直接操作 Model
- [ ] 可选：`ai-assistant.module` 聚合 ai + chat

---

## P2 — Partner 互动 ✅

- [x] `post-like` / `post-comment` / `post-application` Schema
- [x] `POST /posts/:id/like|comments|applications`
- [x] 计数更新、删帖级联（现有实现）
- [ ] `GET /posts/:id/comments` 列表（前端暂未消费）
- [x] `POST /posts/:id/like|comments|applications` 后通知帖主（`meta.activityLegacyId` / `postId` / `type`）

---

## P3 — AI Agent ✅

- [x] `TextParseAgent` — Qwen-Max
- [x] `ImageParseAgent` — Qwen-VL
- [x] `MatchAgent` — Chroma 活动内检索
- [x] `RiskAgent` — spam / 重复帖 / LLM 违规；拒绝文案经 `PostIntentService`
- [x] `AiService` 优先发帖 → 匹配 → DeterministicReply
- [ ] `agent-tools.ts` 注册（与 Handler 管道合并，可选）

---

## P4 — Redis + Chroma ✅

- [x] `RedisModule`、`heat:*` keys
- [x] `sync_posts` collection + activity filter
- [x] `configuration.ts`：`redis.url`、`chroma.postsCollection`

---

## P5 — 文档与清理 ✅

- [x] `docs/ARCHITECTURE.md`
- [x] `README.md`、`.env.example` 与实现一致
- [x] 与 `sync-app/docs/API.md` 对齐
- [x] Profile BFF 委托清晰（`ProfileSummaryService` → Activity / Post / User）
- [x] `db:reset` / seed 文档化（见 `README.md`）
- [ ] E2E：发帖 → 点赞（可选）

---

## P0-H5 — 登录之后做

- [ ] `POST /auth/dev` + JWT + Guard
- [ ] Controller 改 `@CurrentUser()`，关闭生产 demo Query
- [ ] `activity-context.middleware` — `X-Activity-Id`
- [ ] 与前端同 PR 切换 Bearer

## P0-Wx — 更晚

- [ ] `POST /auth/wechat`
- [ ] 生产关闭 `/auth/dev`

---

## API 对照表

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | `/auth/dev` | ⬜ |
| POST | `/auth/wechat` | ⬜ |
| GET/PATCH | `/users/me` | ✅ |
| GET | `/home` | ✅ |
| GET | `/activities`… | ✅ |
| POST/DELETE | `/activities/:id/register` | ✅ |
| GET/POST/PATCH/DELETE | `/posts`… | ✅ |
| POST | `/posts/:id/like|comments|applications` | ✅ |
| GET | `/profile`… | ✅ |
| POST | `/ai/chat` | ✅ |
| GET | `/chat/sessions/:id` | ✅ |
| GET/PATCH | `/notifications/*` | ✅ |

---

## 验收标准

### P2 ✅

- [x] `POST /posts` 后可在活动帖列表查到
- [x] 点赞/评论/申请持久化 MongoDB

### P3 ✅

- [x] AI：Parse → Risk → createPost
- [x] 带图走 ImageParseAgent
- [x] 匹配意图走 MatchAgent
- [x] 拒绝时 SSE `delta` 提示用户

### P4 ✅

- [x] Redis 热度（可降级）
- [x] 同活动 Chroma 帖子检索

### P0（登录期）

- [ ] JWT 写接口鉴权
- [ ] 无 Query 身份

---

## 备注

- 单体 NestJS + 全局 Guard 即可；不必先拆微服务。
- Chroma / Redis 不可用时不阻断主流程。
- 保留 `GET /profile` BFF；登录后只改身份来源。

---

## AI 工程优化（P0–P3，2025-05）

| 阶段 | 主题 | 状态 |
|------|------|------|
| P0 | 会话状态机 + BuddyModule use cases + Post 端口 | ✅ |
| P1 | Intent 规则快路径 / Redis+内存意图缓存 / recommend gate / profile dedupe / Chroma breaker | ✅ |
| P2 | 并行路径 / async Chroma upsert / rate limit / message_complete SSE / 集成测试 / timing logs | ✅ |
| P3 | 测试金字塔 / requestId 日志 / health / PostWriteService / orchestration README | ✅ |
| P4 | JWT / 微信登录 / ActivityRegistration 物理迁入 / PartnerModule rename | ⬜ 延后 |

### P3 验收 ✅

- [x] `IntentRouterService` 集成测试（规则 + mock LLM + 缓存）
- [x] `AiService` recommend_gate → decline → pending_confirmation 测试
- [x] `PostWriteService`：Chroma upsert 失败不阻断 create
- [x] `GET /api/health` → `{ mongodb, redis, chroma }`
- [x] `logAiTurn` + `X-Request-Id` 贯穿 AI 日志
- [x] `PostWriteService` 应用层；`PostService` 薄门面
- [x] 前端 `useAiChatStream` 消费 `message_complete`

### 仍延后（P4+）

- [ ] `AuthModule` / JWT / `POST /auth/*`
- [x] `PartnerModule` 目录 `modules/partner/`
- [x] 意图缓存 Redis 多实例 + `activityLegacyId` 维度 cache key
- [x] 会话 marker → `conversationState` 迁移（`getSession` 持久化）；gate/publish state-only
- [x] 移除 `AiModule` / `OrchestrationModule` 无用 `ProfileModule` 依赖
- [ ] `ALL_AGENT_TOOLS` 注册进 `AgentRuntimeService`（发帖非必须）
- [ ] E2E：发帖 → 点赞
- [ ] 微服务拆分
