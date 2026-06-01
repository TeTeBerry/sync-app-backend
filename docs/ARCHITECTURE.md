# 后端架构（当前实现）

> 目标架构：Gateway → User / Activity / Partner / AiAssistant → 四 Agent → MongoDB / Chroma / Redis  
> **现状**：NestJS **单体**，逻辑分层已对齐目标，**未**拆微服务；REST 使用全局 **JWT Guard** + `RequestActor`（见 [AUTH.md](./AUTH.md)）。

---

## 模块一览

```
AppModule
├── ConfigModule + MongooseModule
├── RedisModule              # 热度缓存（可选）
├── ActivityModule           # 活动 + registration/
├── UserModule               # Demo 用户 seed
├── PartnerModule              # 组队帖（REST 仍为 /posts）
├── ProfileModule            # 个人页 BFF
├── HomeModule               # 首页 BFF
├── NotificationModule
├── ChatModule               # AI 会话持久化
└── AiModule                 # WebSocket 对话 + Agent 编排（AiChatWsServer）
    ├── AgentsModule         # 四 Agent
    ├── OrchestrationModule  # 状态机 / Handler 管道
    ├── RagModule / ChromaModule
    └── BuddyModule             # 发帖 / 匹配编排（use cases + PostIntentService 门面）
        ├── recommend-before-create.use-case.ts
        ├── match-posts.use-case.ts
        └── create-post-from-chat.use-case.ts
    ├── orchestration/          # AiTurnPipeline（单轮编排）+ legacy AgentRuntime（仅 DeterministicReply）
    ├── presentation/           # AiSseBuilder（流式事件组装，经 WS 下发；类名历史遗留）
    ├── gate/ match/ publish/ risk/ intent/  # 原 ai/utils 按域拆分
    ├── PostAgentAdaptersModule # PartnerModule ↔ AgentsModule 端口适配
```

| 目标模块 | 代码路径 | 状态 |
|----------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`（Query 身份）✅ |
| Activity | `modules/activity/` | 列表 / 匹配 / 详情 / 报名（`registration/`）✅ |
| Partner | `modules/partner/` | 帖子 CRUD + `PostInteractionService`（赞/评/申请）✅ |
| AiAssistant | `ai/` + `modules/chat/` | WebSocket + Agent ✅ |
| BFF | `home/`、`profile/` | 聚合读 ✅ |

---

## AI 对话流程

`ws://<host>/api/ai/chat/ws`（`AiChatWsServer`）将每轮 `send` 交给 `AiService.streamChat`；单轮逻辑在 `AiTurnPipeline`，流式事件由 `AiSseBuilder` 组装后经 WebSocket 下发：

```
用户消息
  → AiService：校验、限流、会话合并
  → AiTurnPipeline.runTurn
       → IntentRouterService.resolve（规则快路径优先，未命中再 qwen-max 意图 JSON）
       → syncProfileOnce（search/create 路径各一次）
       → search_posts：collectMatchOnly
       → create_post：collectBuddyIntentFlow（recommend gate → 发帖）
       → quick_reply：collectDeterministicOnly
  → AiSseBuilder：post_created / post_recommendations / conversation_patch / suggested_replies 等
  → AiService：message_complete、ChatService.saveTurn、done
```

### P2 性能与成本（已实现）

| 项 | 实现 |
|----|------|
| 并行 | `create-post`：TextParse/ImageParse ∥ resolveActivity；`match-posts`：profile sync ∥ activity lookup；recommend 传 `preResolvedActivity` |
| 风控成本 | 快捷「确认发布」：`RiskAgent.assess(..., { rulesOnly: true })`，规则+重复通过后跳过 Qwen-Max |
| Chroma 写 | `PostWriteService.scheduleEmbeddingUpsert` 异步 + 失败 warn；删帖仍 deprecate |
| 限流 | `AiRateLimitService` Redis INCR 或内存 fallback；`config.ai.rateLimit`（默认 30 次 / 5 分钟 / userId∥sessionId） |
| 意图缓存 | `IntentCacheService` Redis SETEX + 进程内 Map 降级；key 含 `sessionId` / `activityLegacyId` / `hasImage` / input hash；`config.ai.intentCache` |
| Chroma circuit | `config.chroma.circuit`（failureThreshold、cooldownMs）→ `ChromaService` |
| 流式帧 | `delta` + `message_complete` + `done`（WebSocket JSON） |
| AI 匹配配额 | `MatchPostsFromChatUseCase` 经 `AiMatchQuotaService` 预检；`post_recommendations` 有结果时服务端扣次 |
| 可观测 | `logAiTurn`：`ms_intent` / `ms_match` / `ms_buddy` / `ms_total`；create-post：`ms_parse` / `ms_risk` |

### 会话状态机（ConversationState）

结构化状态持久化在 MongoDB `chat.conversationState`，状态变更时推送 `conversation_patch`：

| flow | 含义 | 附加字段 |
|------|------|----------|
| `idle` | 默认 | — |
| `recommend_gate` | 已展示搭子推荐，等待用户决定 | `gate.activityLegacyId`, `gate.shownPostIds`, `gate.empty` |
| `publish_confirm` | 草稿待发，等待「确认发布」 | `publishDraft.activityLegacyId`, `publishDraft.draftBody` |
| `clarify_buddy` | 缺槽位，等待补充出行信息 | — |

`ChatService.getSession`：无 `conversationState.flow` 时从助手文案 marker **一次性迁移**并写回 Mongo。运行时 `isAwaiting*` 仅读 `conversationState.flow`（不再扫历史消息）；marker 仍保留在助手回复文案中供展示/测试。

### PartnerModule 端口（解耦 AgentsModule）

`PostService` 依赖 `POST_MODERATION_PORT` / `POST_NOTIFICATION_PORT`，由 `PostAgentAdaptersModule`（`RiskAgent` / `NoticeAgent` 适配）注入。`PartnerModule` 不再直接 import `AgentsModule`；`AgentsModule` 仅依赖 `PartnerRepositoryModule`（`POST_REPOSITORY`）。

### 四 Agent（`src/ai/agents/`）

| Agent | 实现 | 说明 |
|-------|------|------|
| TextParseAgent | Qwen-Max `invokeJson` | 文本 → 结构化发帖字段 |
| ImageParseAgent | Qwen-VL `invokeVisionJson` | 截图 → 结构化字段 |
| MatchAgent | Chroma `queryPostsByActivity` | 活动内向量检索 |
| RiskAgent | 规则 + Qwen-Max + 重复帖检测 | spam / 重复 / 严重违规 |

发帖 Agent 经 `PostIntentService` 编排；`ALL_AGENT_TOOLS = []`，**未**接入 `AgentRuntimeService` 工具链（DeterministicReply 仍用 Handler 管道 + 空工具列表，非 LLM tool-calling）。详见 `src/ai/orchestration/README.md`。

### P3 工程优化（2025-05）

| 项 | 实现 |
|----|------|
| 测试金字塔 | `IntentRouterService` / `AiService` recommend_gate 流 / `PostWriteService` Chroma 降级 |
| 可观测性 | `X-Request-Id` + `logAiTurn` 结构化日志；`GET /api/health` 报告 mongodb / redis / chroma |
| 编排澄清 | `orchestration/agent-runtime.service` + `agent-tools.service`（发帖走 Buddy use cases；DeterministicReply 仍用） |
| Post 互动 | `PostInteractionService`（赞/评/申请）；`PostWriteService`（写帖 + Chroma） |
| 流式事件 | `message_complete`（完整回复，前端可跳过打字机） |

### 传输与监控

| 项 | 说明 |
|----|------|
| **主通道** | `ws://<host>/api/ai/chat/ws`（`AiChatWsServer` 挂 HTTP `upgrade`） |
| **无 HTTP SSE** | 未暴露 `POST /api/ai/chat`；`AiService.streamChat` 仅由 WS handler 调用 |
| **会话 REST** | `GET/DELETE /api/chat/sessions/:id`（历史拉取，非流式） |
| **健康检查** | `GET /api/health` 含 `ai: { transport: 'websocket', path }` |
| **日志** | 启动行打印 WS 路径；`logAiTurn` + `X-Request-Id` 按轮次记录 intent/timing |

---

## 数据与基础设施

| 存储 | 用途 |
|------|------|
| **MongoDB** | user, activity, activity-registration, post, post-like, post-comment, post-application, chat, notification |
| **Redis** | `heat:global`、`heat:activity:{legacyId}`（不可用则降级） |
| **Chroma** | `sync_knowledge`（活动 RAG）、`sync_posts`（帖子向量，发帖 upsert / 删帖删除） |

---

## 身份与鉴权

详见 [AUTH.md](./AUTH.md)。

- **REST**：`JwtAuthGuard`（`AuthCoreModule`）→ `req.actor: RequestActor`；Controller 使用 `@CurrentActor()`
- **Demo 开发**：`AUTH_ALLOW_DEMO=true` 时 Query `userId` / `authorName` 回退为 demo actor
- **AI WebSocket**：`resolveWsChatActor` → `ChatRequestDto.actor`（body 仍可带 `userId` 供未登录 demo）
- **活动上下文**：`ActivityContextMiddleware` 解析 `X-Activity-Id` → `req.scopedActivityLegacyId`；WS upgrade 同头；与 body/query 在调用处 `resolveEffectiveActivityLegacyId` 合并

---

## 主要 REST 接口

详见 `sync-app/docs/API.md` 与 `README.md`。

---

## 待办（非阻塞 H5 demo）

- P0：生产关闭 demo Query（`AUTH_ALLOW_DEMO=false`）；微信登录 E2E 验收
- P1（AI 优化，已实现）：Intent 规则快路径 + resolve 日志/缓存；`legacy_cascade` 与 `create_post` 合并；推荐门控空结果 + `suggested_replies` 流式帧；单轮 `syncProfileFromChat`；匹配 `matchReason` + Chroma 降级/circuit breaker；有图仍走 proactive recommend
- P2（AI 优化，已实现）：关键路径 `Promise.all`（parse∥resolveActivity、profile∥match）；快捷确认发帖 `RiskAgent.rulesOnly` 跳过 LLM；REST/AI 发帖 Chroma upsert 异步 + 失败日志；AI Redis/内存限流 30/5min；WS `message_complete`；结构化 turn 日志（`ms_intent`/`ms_match`/`ms_buddy`/`ms_total`）；`AgentRuntimeService` 工具链仍为空（发帖走 Buddy use cases）
- ~~P1：Registration 物理迁入 ActivityModule~~ ✅ `modules/activity/registration/`
- P5：通知 meta 深链、Partner 目录可选 rename

对照清单：`docs/BACKEND-REFACTOR-CHECKLIST.md`

---

## 测试

单元测试集中在 `test/unit/`（目录与 `src/` 域对应），共享 mock 在 `test/mocks/`。运行 `npm test`；E2E 见 `test/app.e2e-spec.ts` 与 `npm run test:e2e`。说明见 `test/README.md`。
