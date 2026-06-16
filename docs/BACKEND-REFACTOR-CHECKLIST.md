# 后端改造 Checklist

> 目标：Gateway + User / Activity / AiAssistant + MongoDB / Chroma / Redis  
> 前端对照：`sync-app/docs/FRONTEND-REFACTOR-CHECKLIST.md`  
> 架构快照：`docs/ARCHITECTURE.md`  
> **策略**：H5 业务先行；登录 / JWT **整段后置**。

---

## 进度总览

| 阶段 | 主题 | 状态 |
|------|------|------|
| P1 | 读 API + 活动 / 用户 | ✅ 完成 |
| P2 | 活动体验四域（itinerary / live-info / travel-guide / travel-plan） | ✅ 完成 |
| P3 | AI 对话 + 意图路由 + 确定性回复 | ✅ 完成 |
| P4 | Redis 热度 + Chroma 活动知识库（可选） | ✅ 完成 |
| P5 | 文档 + BFF 清理 | ✅ 完成 |
| P0-H5 | Dev JWT + Guard | ✅ 完成 |
| P0-Wx | 微信登录 | ⬜ 更晚 |
| P2-debt | 契约 / import / 废弃路径 | ✅ 完成 |
| P1-contract | Chat 共享类型 + contract tests | ✅ 完成 |
| P3-dev | check / husky / CI | ✅ 完成 |
| AE | Activity Experience 聚合 + shared 契约 | ✅ 完成 |

---

## 当前执行顺序

| 顺序 | 阶段 | 身份方式 |
|------|------|----------|
| 1–5 | P1–P5 业务 | Query `userId`（demo）或 Bearer |
| 6 | P0-H5 | Bearer JWT |
| 7 | P0-Wx | Bearer JWT |

---

## 现状快照

### 已实现

- **ActivityModule**：活动列表 / 详情 / 报名（`registration/`）
- **ActivityExperienceModule**：travel-plan、itinerary、live-info、travel-guide
- **UserModule**：`GET/PATCH /users/me`、画像 hints 同步
- **ProfileModule / HomeModule**：BFF 聚合读
- **AiModule**：WebSocket `/api/ai/chat/ws`；`AiTurnPipeline` + `DeterministicReplyService`
- **AgentsModule**：`NoticeAgent`（活动更新通知）
- **AccountRiskModule**：违规累计与互动限制
- **Chroma**：`sync_knowledge`（活动 RAG，可选）
- **Redis**：`HomeService` 热度缓存（graceful degrade）
- **WS 流式帧**：`delta`、`activity_recommendation`、`conversation_patch`、`suggested_replies`、`message_complete`、`done`
- **WS JWT actor**：upgrade Bearer → `resolveWsChatActor`
- **`npm run smoke:api`** / **`npm run smoke:ws`**

### 未实现 / 延后

- 生产 `AUTH_ALLOW_DEMO=false` 运维验收
- `ALL_AGENT_TOOLS` 注册进 `AgentRuntimeService`（可选）
- 微服务拆分

---

## P1 — 核心模块 ✅

### ActivityModule

- [x] `GET /activities`、`/resolve`、`/:legacyId`
- [x] `POST/DELETE /activities/:legacyId/register`
- [x] Registration 在 `activity/registration/`

### UserModule

- [x] `GET/PATCH /users/me`
- [x] Demo seed / health

### BFF

- [x] `GET /home` — 热度 + `signupEvents`
- [x] `GET /profile`、`GET /profile/activities`

### AiAssistantModule

- [x] `ws://…/api/ai/chat/ws`
- [x] `ChatModule` 会话持久化
- [x] `IntentRouterService` — 规则快路径 + 可选 LLM JSON
- [x] `DjInfoTurnHandler`、`DeterministicReplyService`

---

## P2 — 活动体验四域 ✅

- [x] `travel-plan/` — 行程保存、票据识别
- [x] `itinerary/` — 电音时间表生成/保存
- [x] `live-info/` — 现场认证、UGC 实况
- [x] `travel-guide/` — 高德 POI + 出行攻略生成

---

## P3 — AI 工程 ✅

- [x] `AiTurnPipeline` 单轮编排
- [x] `AiRateLimitService` — Redis / 内存限流
- [x] `IntentCacheService` — 意图缓存
- [x] `logAiTurn` + `X-Request-Id` 可观测
- [x] `GET /api/health` → `{ ai: { transport, path }, mongodb, redis, chroma }`

---

## P4 — Redis + Chroma ✅

- [x] `RedisModule`、`heat:*` keys
- [x] `configuration.ts`：`redis.url`、`chroma` 知识库 collection

---

## P5 — 文档与清理 ✅

- [x] `docs/ARCHITECTURE.md`
- [x] `README.md` 环境变量与实现一致
- [x] 与 `sync-app/docs/API.md` 对齐
- [x] `db:reset` / seed 文档化

---

## 契约与类型 ✅

> 真源：`src/shared/chat/`；前端 `@sync/chat-contracts` re-export。

- [x] `conversation-state.types.ts`、`ai-stream-event.types.ts`、`chat-message.types.ts`
- [x] `test/contract/chat-*.contract.spec.ts`
- [x] AI 层 import 收敛至 `shared/chat`

### 仍可选

- [ ] `TravelGuidePlan` 等 DTO 收进 `shared/` + contract test
- [ ] 正式 `packages/chat-contracts` workspace

---

## 技术债 ✅（2025–2026）

### 身份与废弃路径

- [x] 删除 `jwt-actor.middleware.ts`；统一 `JwtAuthGuard` + `req.actor`
- [x] 删除 `orchestration/legacy/*` 重导出

### 前端对齐

- [x] Bearer → `JwtAuthGuard`；`ownerQueryParams()` 有 token 时无 demo Query

### 架构（2026-06）

- [x] `ActivityLookupModule` + `ACTIVITY_LOOKUP_PORT` 打破 Nest 环
- [x] 出行攻略出发地：后端单源 `place-suggestions` API

---

## P0-H5 — 登录 ✅

- [x] `POST /auth/dev` + JWT + `JwtAuthGuard`
- [x] `@CurrentActor()` / `RequestActor`
- [x] `activity-context.middleware` — `X-Activity-Id`
- [ ] 生产关闭 demo Query（`AUTH_ALLOW_DEMO=false`）

## P0-Wx — 更晚

- [ ] `POST /auth/wechat` 生产验收
- [ ] 生产关闭 `/auth/dev`

---

## API 对照表

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | `/auth/dev` | ✅ |
| POST | `/auth/wechat` | ✅（需微信 AppId/Secret） |
| GET/PATCH | `/users/me` | ✅ |
| GET | `/home` | ✅ |
| GET | `/activities`… | ✅ |
| POST/DELETE | `/activities/:id/register` | ✅ |
| GET | `/profile` / `/profile/activities` | ✅ |
| GET/POST | `/activities/:id/live-info/*` | ✅ |
| POST | `/activities/:id/travel-guide/generate` | ✅ |
| POST | `/reports` | ✅（`targetType`: `user` \| `comment`） |
| WS | `/ai/chat/ws` | ✅ |
| GET | `/chat/sessions/:id` | ✅ |
| GET/PATCH | `/notifications/*` | ✅ |

---

## 验收标准

### P1–P3 ✅

- [x] 活动 CRUD + 报名 API 可用
- [x] AI WebSocket：`delta` → `message_complete` → `done`
- [x] 出行攻略生成 + 现场资讯 API

### P4 ✅

- [x] Redis 热度（可降级）
- [x] Chroma 活动知识库（可降级）

### P0（登录期）

- [x] JWT 写接口鉴权（`JwtAuthGuard`）
- [ ] 生产无 Query 身份（运维验收）

---

## 备注

- 单体 NestJS + 全局 Guard 即可；不必先拆微服务。
- Chroma / Redis 不可用时不阻断主流程。
- 测试：`test/unit/`；`npm run check`；说明见 `test/README.md`。
