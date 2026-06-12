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
| P4 | Redis + Chroma 活动知识库 | ✅ 完成（**2026-06 已移除**帖子向量与用户画像向量；Chroma 仅活动知识库） |
| P5 | 文档 + BFF 清理 | ✅ 完成 |
| P0-H5 | Dev JWT + Guard | ✅ JwtAuthGuard + RequestActor；生产设 `AUTH_ALLOW_DEMO=false` |
| P0-Wx | 微信登录 | ⬜ 更晚 |
| **P2-debt** | **可迭代技术债**（契约 / import / 废弃路径） | ✅ 完成（2025-06） |
| **P1-contract** | **契约与类型**（Chat 共享类型 + contract tests） | ✅ 完成（2025-06） |
| **P3-dev** | **开发体验**（check / husky / 工作区脚本 / 文档） | ✅ 完成（2025-06） |
| **AE** | **Activity Experience**（四域聚合 / infra / shared 契约） | ✅ 完成（2026-06） |

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

- **PartnerModule**（`modules/partner/`）：`POST/PATCH/DELETE /posts`；`POST .../like|comments`
- **Schema**：`post-like`、`post-comment`（`post-application` 仅保留删帖时历史数据清理）
- **AiModule**：WebSocket（`/api/ai/chat/ws`）；`PostIntentService` 编排四 Agent
- **Agents**：`text-parse` / `image-parse` / `risk`（`src/ai/agents/`）
- **Chroma**：`sync_knowledge` + `sync_user_profiles`（**已移除** `sync_posts` 帖子向量）
- **Redis**：`HomeService` 热度缓存（graceful degrade）
- **WS 流式帧**：`post_created`；审核拒绝 → `delta` 文案（非 `error`）
- **WS JWT actor**：upgrade `Authorization: Bearer` → `verifyBearerActor` + `resolveWsChatActor`（`connected.auth`：`jwt` | `demo`）
- **B2 无效 Bearer**：`classifyBearerAuth` → REST 401；WS `error` + close（不与 demo Query 混用）
- **`npm run smoke:ws`**：JWT / invalid / demo 三用例

### 未实现 / 延后

- ~~路由级 `JwtAuthGuard`~~ ✅ 全局 `APP_GUARD` + `@Public()` 例外
- ~~ActivityRegistration 物理迁入 ActivityModule~~ ✅ `activity/registration/`
- ~~`PartnerModule` 目录 rename~~ ✅ `modules/partner/`
- `ALL_AGENT_TOOLS` 注册进 `AgentRuntimeService`（发帖走独立编排，非必须）
- 生产限流、关闭 demo Query

---

## P1 — 四模块（部分完成）

### ActivityModule ✅ 读

- [x] `GET /activities`、`/resolve`、`/:legacyId`
- [x] `POST/DELETE /activities/:legacyId/register`
- [x] Registration 从 `profile/` 迁入 `activity/registration/`

### UserModule

- [x] `GET/PATCH /users/me`
- [x] Demo seed / health

### PartnerModule ✅ 核心

- [x] 帖子 CRUD + 互动 API
- [x] 创建时 Chroma upsert；删帖删向量（**已移除** — 帖子不再写 Chroma）
- [x] 目录 `modules/partner/`（`PartnerModule` / `PartnerRepositoryModule` / `PartnerWriteModule`）

### AiAssistantModule ✅ 核心

- [x] `ws://…/api/ai/chat/ws`（`AiChatWsServer` + `AiService.streamChat`）
- [x] `ChatModule` 会话持久化
- [x] AI 注入 `PostService.createPost`，不直接操作 Model
- [ ] 可选：`ai-assistant.module` 聚合 ai + chat

---

## P2 — Partner 互动 ✅

- [x] `post-like` / `post-comment` Schema（`post-application` 仅删帖级联清理历史数据）
- [x] `POST /posts/:id/like|comments`
- [x] 计数更新、删帖级联（现有实现）
- [ ] `GET /posts/:id/comments` 列表（前端暂未消费）
- [x] `POST /posts/:id/like|comments` 后通知帖主（`meta.activityLegacyId` / `postId` / `type`）

---

## P3 — AI Agent ✅

- [x] `TextParseAgent` — `LlmService.invokeJson`（混元）
- [x] `ImageParseAgent` — DashScope VL `invokeVisionJson`
- [x] `MatchAgent` — Chroma 活动内检索（**已移除**）
- [x] `RiskAgent` — spam / 重复帖 / LLM 违规；拒绝文案经 `PostIntentService`
- [x] `AiService` 优先发帖 → DeterministicReply（**已移除**向量检索 / recommend gate）
- [ ] `agent-tools.ts` 注册（与 Handler 管道合并，可选）

---

## P4 — Redis + Chroma ✅

- [x] `RedisModule`、`heat:*` keys
- [x] `sync_posts` collection + activity filter（**已移除** — 见 `ARCHITECTURE.md`）
- [x] `configuration.ts`：`redis.url`、`chroma` 知识库 / 画像 collection

---

## P5 — 文档与清理 ✅

- [x] `docs/ARCHITECTURE.md`
- [x] `README.md` 环境变量说明与实现一致
- [x] 与 `sync-app/docs/API.md` 对齐
- [x] Profile BFF 委托清晰（`ProfileSummaryService` → Activity / Post / User）
- [x] `db:reset` / seed 文档化（见 `README.md`）
- [ ] E2E：发帖 → 点赞（可选）

---

## P2 — 可迭代技术债 ✅（2025-06）

> 与上文 **「P2 — Partner 互动」** 不同：此处指架构评审后的**维护性 / 契约收敛**，可分批迭代。  
> 对照：[`AUTH.md`](AUTH.md)、[`ARCHITECTURE.md`](ARCHITECTURE.md)、前端 [`API.md`](../../sync-app/docs/API.md)。

### 身份与废弃路径

- [x] 删除未使用的 `actorToLegacyQuery`（`resolve-request-actor.ts`）
- [x] 删除 `jwt-actor.middleware.ts`（`JwtActorMiddleware` 别名）；文档改为 `JwtAuthGuard` + `req.actor`
- [x] 删除 `ai/utils/actor-user.util.ts`（统一 `common/auth/actor-user.util`）
- [x] 删除 `orchestration/legacy/*` 重导出；编排真源为 `orchestration/agent-runtime.service`

### Chat 契约与 import

- [x] `ChatMessageDto`：AI 层 import 迁至 `src/shared/chat`（不再引 `ai/presentation/chat-message.dto`）
- [x] `ai/conversation`：`conversation-state.types` 重导出移除；`index` 导出 `shared/chat` 类型
- [x] 删除 `conversation-state.bootstrap.ts`（仅用 `migrateConversationStateFromHistory`）
- [x] ~~`ai/presentation/chat-message.dto.ts` 薄 re-export~~ → 已删，AI 层直引 `shared/chat`

### Partner / 历史作者 / 风控

- [x] `StoredAuthorRecord` + `UserService.resolveProfileFromStoredAuthor`（评论头像等）
- [x] `PostModerationPort`：`assessPost` / `assessComment` 收 `RequestActor`
- [x] `RiskCommentInput`：`actor?`（与发帖 `RiskAgentInput` 一致）
- [x] `resolveProfileFromLegacy` 保留为 `@deprecated` 别名（无新调用方）

### 前端对齐（同批）

- [x] `requestContext` / `API.md`：Bearer → `JwtAuthGuard`，不再描述 Query 注入 actor
- [x] `postOwnership`：有 `authorUserId` 时只比 id；`authorName` 仅无 id 旧数据回退

### 仍有意保留 / 未做

| 项 | 说明 |
|----|------|
| ~~`resolveProfileFromLegacy`~~ | ✅ 已删除 |
| `GET /posts/:id/comments` 列表 | 产品未消费 |
| 生产 `AUTH_ALLOW_DEMO=false` | P0 运维验收，非代码债 |
| 微信 E2E、JWT-only smoke | P0 验收 |
| 跨模块 E2E（发帖 → 点赞 → 通知） | P3 / 可选 |

### 关联已完成（架构 P1，非本表 P2 Partner）

- [x] `X-Activity-Id` → `activity-context.middleware` / `req.scopedActivityLegacyId`
- [x] 出行攻略出发地：后端单源，前端只信 `place-suggestions` API

---

## P1 — 契约与类型 ✅（2025-06）

> 真源：`src/shared/chat/`；前端 `@sync/chat-contracts` 仅 re-export。

### 共享类型

- [x] `conversation-state.types.ts` — `ConversationState` + version
- [x] `ai-stream-event.types.ts` — `AiStreamEvent` 判别联合
- [x] `chat-cards.types.ts` — `RecommendedPostCard` / `RecommendedActivityCard`
- [x] `chat-message.types.ts` — `ChatMessage` / `ChatMessageRole`（与 `ChatMessageDto` 对齐）
- [x] `chat-message.dto.ts` — class-validator DTO（实现层，非契约重复定义）

### 契约测试

- [x] `test/contract/chat-conversation-state.contract.spec.ts`
- [x] `test/contract/chat-ai-stream-event.contract.spec.ts`
- [x] `test/contract/chat-frontend-reexports.contract.spec.ts`（无同级 `sync-app` 时 skip）

### Import 收敛

- [x] AI 层 `AiStreamEvent` / 卡片类型 → `shared/chat`（不再经 `presentation/ai-stream-event.view` 业务 import）
- [x] 前端 `aiChat.ts` / `conversationState.ts` 仅 re-export；`AiChatMessage` → `ChatMessage`

### 仍可选

- [ ] `TravelGuidePlan` 等出行攻略 DTO 收进 `shared/` + contract test
- [ ] 正式 `packages/chat-contracts` workspace（替代路径 alias）

---

## P3 — 开发体验 ✅（2025-06）

> 本地与 CI 统一 `npm run check`；提交前 lint-staged；工作区见上级目录 `sync/CONTRIBUTING.md`。

### 质量脚本

- [x] `npm run check` — typecheck + lint + format:check + test（含 contract）
- [x] GitHub Actions — `.github/workflows/ci.yml`（`check` + `nest build`）
- [x] `lint-staged` + husky `pre-commit`（`npm install` 后 `prepare` 启用）

### 工作区（`sync/` 父目录，非 Git 仓库）

- [x] `package.json` → `npm run check:all`（先后端 + 前端）
- [x] `CONTRIBUTING.md`、`.editorconfig`
- [x] Dependabot — `.github/dependabot.yml`（每周 npm）

### 文档对齐

- [x] README / checklist 身份描述 → `JwtAuthGuard` + `RequestActor`（非「无 JWT」）

---

## P0-H5 — 登录之后做

- [x] `POST /auth/dev` + JWT + `JwtAuthGuard`
- [x] `@CurrentActor()` / `RequestActor` 业务层
- [x] `activity-context.middleware` — `X-Activity-Id` → `req.scopedActivityLegacyId`
- [x] 前端 Bearer + `ownerQueryParams()` 空 Query（已实现）
- [ ] 生产关闭 demo Query（`AUTH_ALLOW_DEMO=false` 运维验收）

## P0-Wx — 更晚

- [ ] `POST /auth/wechat`
- [ ] 生产关闭 `/auth/dev`

---

## API 对照表

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | `/auth/dev` | ✅（`AUTH_MODE=dev` 或非 production） |
| POST | `/auth/wechat` | ✅（需微信 AppId/Secret） |
| GET/PATCH | `/users/me` | ✅ |
| GET | `/home` | ✅ |
| GET | `/activities`… | ✅ |
| POST/DELETE | `/activities/:id/register` | ✅ |
| GET/POST/PATCH/DELETE | `/posts`… | ✅ |
| POST | `/posts/:id/like|comments` | ✅ |
| GET | `/profile`… | ✅ |
| WS | `/ai/chat/ws` | ✅ |
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
- [x] MatchAgent（**已移除**）
- [x] 拒绝时 WS `delta` 帧提示用户

### P4 ✅

- [x] Redis 热度（可降级）
- [x] 同活动 Chroma 帖子检索（**已移除**）

### P0（登录期）

- [x] JWT 写接口鉴权（`JwtAuthGuard`）
- [ ] 生产无 Query 身份（`AUTH_ALLOW_DEMO=false` + 运维验收）

---

## 备注

- **2026-06 技术债**：`AiStreamEventBuilder` 文件重命名；`src/ai/{parser,llm,gate,services}` 空目录删除；`UserRepositoryModule` / `ACTIVITY_LOOKUP_PORT` / `POST_READ_PORT` 打破 Nest `forwardRef` 环。
- 单体 NestJS + 全局 Guard 即可；不必先拆微服务。
- Chroma / Redis 不可用时不阻断主流程。
- 保留 `GET /profile` BFF；登录后只改身份来源。

---

## AI 工程优化（P0–P3，2025-05）

| 阶段 | 主题 | 状态 |
|------|------|------|
| P0 | 会话状态机 + BuddyModule use cases + Post 端口 | ✅ |
| P1 | Intent 规则快路径 / Redis+内存意图缓存 / recommend gate（**已移除**）/ profile dedupe / Chroma breaker | ✅ |
| P2 | 并行路径 / async Chroma upsert（帖子，**已移除**）/ rate limit / message_complete WS 帧 / 集成测试 / timing logs | ✅ |
| P3 | 测试金字塔 / requestId 日志 / health / PostWriteService / orchestration README | ✅ |
| P4 | JWT / 微信登录 / ActivityRegistration 物理迁入 / PartnerModule rename | ⬜ 延后 |

### P3 验收 ✅

- [x] `IntentRouterService` 集成测试（规则 + mock LLM + 缓存）
- [x] `AiService` recommend_gate → decline → pending_confirmation 测试（**已移除** recommend gate；保留发帖 / 确认发布测试）
- [x] `PostWriteService`：Chroma upsert 失败不阻断 create（**已移除** 帖子 Chroma 写入）
- [x] `GET /api/health` → `{ ai: { transport, path }, mongodb, redis, chroma }`
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
