# 后端架构（当前实现）

> 目标架构：Gateway → User / Activity / Partner / AiAssistant → 四 Agent → MongoDB / Chroma / Redis  
> **现状**：NestJS **单体**，逻辑分层已对齐目标，**未**拆微服务；REST 使用全局 **JWT Guard** + `RequestActor`（见 [AUTH.md](./AUTH.md)）。

---

## 模块一览

```
AppModule
├── ConfigModule + MongooseModule
├── RedisModule              # 热度缓存（可选）
├── infra/llm, infra/chroma  # LLM / 活动知识向量检索（自 ai/ 剥离）
├── ActivityModule           # 活动 + registration/
├── ActivityExperienceModule # 活动域聚合（travel-plan / itinerary / live-info / travel-guide）
├── UserModule               # Demo 用户 seed
├── PartnerModule              # 帖子（REST：GET/POST/DELETE /posts）
├── ProfileModule            # 个人页 BFF（摘要 / 活动 / 帖子）
├── HomeModule               # 首页 BFF
├── NotificationModule
├── ChatModule               # AI 会话持久化
├── shared/                  # 前后端契约（chat、travel-plan、itinerary、live-info）
└── AiModule                 # WebSocket 对话 + Agent 编排（AiChatWsServer）
    ├── AgentsModule         # Text/Image/Risk/Notice Agent
    ├── OrchestrationModule  # 状态机 / Handler 管道
    ├── RagModule / InfraChromaModule
    └── BuddyModule             # 发帖编排（create-post-from-chat use case + PostIntentService 门面）
        └── create-post-from-chat.use-case.ts
    ├── orchestration/          # AiTurnPipeline（单轮编排）+ legacy AgentRuntime（仅 DeterministicReply）
    ├── presentation/           # AiStreamEventBuilder（流式事件组装，经 WS 下发）
    ├── gate/ publish/ risk/ intent/  # 原 ai/utils 按域拆分
    ├── PostAgentAdaptersModule # PartnerModule ↔ AgentsModule 端口适配
```

| 目标模块 | 代码路径 | 状态 |
|----------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`（Query 身份）✅ |
| Activity | `modules/activity/` | 列表 / 关键词解析 / 详情 / 报名（`registration/`）✅ |
| Partner | `modules/partner/` | 帖子创建 / 列表 / 删帖（赞评 API 已移除）✅ |
| AiAssistant | `ai/` + `modules/chat/` | WebSocket + Agent ✅ |
| BFF | `home/`、`profile/` | 聚合读 ✅ |
| ActivityExperience | `modules/activity-experience/` | 四域 API 聚合 ✅ |

### 活动域 API（`activities/:legacyId/*`）

| 子域 | 路径 | 说明 |
|------|------|------|
| Travel plan | `travel-plan/` | 行程计划保存、票据识别 |
| Itinerary | `itinerary/` | 电音时间表生成/保存 |
| Live info | `live-info/` | 现场认证、UGC 实况 |
| Travel guide | `travel-guide/` | 高德地图 POI + 路线攻略生成（`AMAP_KEY`） |

详见 [`modules/activity-experience/README.md`](../src/modules/activity-experience/README.md)。

### 读端口层（打破 Nest 模块环）

| 模块 / 端口 | 用途 |
|-------------|------|
| `UserRepositoryModule` + `USER_REPOSITORY` | 用户持久化；`MediaSecurityModule` 仅依赖此层 |
| `ActivityLookupModule` + `ACTIVITY_LOOKUP_PORT` | 活动只读查询；报名 / 发帖校验 / BFF |
| `PartnerReadModule` + `POST_READ_PORT` | 帖子只读；`HomeModule` / `ProfileModule` BFF |

> LLM 能力统一由 `infra/llm/InfraLlmModule` 提供（原 `ai/parser` 已移除）。  
> 文本（JSON / Agent）经 `TextLlmClient`（混元）；视觉经 `LlmService.invokeVisionJson`（千问 VL / `QWEN_API_KEY`）。详见 [LLM.md](./LLM.md)。

---

## AI 对话流程

`ws://<host>/api/ai/chat/ws`（`AiChatWsServer`）将每轮 `send` 交给 `AiService.streamChat`；单轮逻辑在 `AiTurnPipeline`，流式事件由 `AiStreamEventBuilder` 组装后经 WebSocket 下发：

```
用户消息
  → AiService：校验、限流、会话合并
  → AiTurnPipeline.runTurn
       → IntentRouterService.resolve（规则快路径优先，未命中再 TextLlm JSON 意图）
       → syncProfileOnce（发帖路径）
       → create_post：PostIntentService.tryCreatePostFromChat
       → quick_reply / chitchat / dj_info / activity_enter：DeterministicReply 或 Agent
  → AiStreamEventBuilder：post_created / activity_recommendation / conversation_patch / suggested_replies 等
  → AiService：message_complete、ChatService.saveTurn、done
```

**已移除**：帖子向量检索、`search_posts`、`post_recommendations`、推荐门控（`recommend_gate`）、`AiMatchQuota`、Chroma 用户画像向量。

### P2 性能与成本（已实现）

| 项 | 实现 |
|----|------|
| 并行 | `create-post`：TextParse/ImageParse ∥ resolveActivity |
| 风控成本 | 快捷「确认发布」：`RiskAgent.assess(..., { rulesOnly: true })`，规则+重复通过后跳过文本 LLM |
| 限流 | `AiRateLimitService` Redis INCR 或内存 fallback；`config.ai.rateLimit`（默认 30 次 / 5 分钟 / userId∥sessionId） |
| 意图缓存 | `IntentCacheService` Redis SETEX + 进程内 Map 降级；key 含 `sessionId` / `activityLegacyId` / `hasImage` / input hash；`config.ai.intentCache` |
| 流式帧 | `delta` + `message_complete` + `done`（WebSocket JSON） |
| 可观测 | `logAiTurn`：`ms_intent` / `ms_buddy` / `ms_total`；create-post：`ms_parse` / `ms_risk` |

### 会话状态机（ConversationState）

结构化状态持久化在 MongoDB `chat.conversationState`，状态变更时推送 `conversation_patch`：

| flow | 含义 | 附加字段 |
|------|------|----------|
| `idle` | 默认 | — |
| `collect_post_body` | 等待用户填写帖子正文 | `publishDraft.activityLegacyId` |
| `publish_confirm` | 草稿待发，等待「确认发布」 | `publishDraft.activityLegacyId`, `publishDraft.draftBody` |
| `clarify_buddy` | 缺槽位，等待补充出行信息 | — |

`ChatService.getSession`：无 `conversationState.flow` 时从助手文案 marker **一次性迁移**并写回 Mongo；历史 `recommend_gate` 状态会归一为 `idle`。

### PartnerModule 端口（解耦 AgentsModule）

`PostService` 依赖 `POST_MODERATION_PORT` / `POST_NOTIFICATION_PORT`，由 `PostAgentAdaptersModule`（`RiskAgent` / `NoticeAgent` 适配）注入。`PartnerModule` 不再直接 import `AgentsModule`；`AgentsModule` 仅依赖 `PartnerRepositoryModule`（`POST_REPOSITORY`）。

### 四 Agent（`src/ai/agents/`）

| Agent | 实现 | 说明 |
|-------|------|------|
| TextParseAgent | `LlmService.invokeJson`（混元） | 文本 → 结构化发帖字段 |
| ImageParseAgent | `LlmService.invokeVisionJson`（DashScope VL） | 截图 → 结构化字段 |
| RiskAgent | 规则 + 文本 LLM + 重复帖检测 | spam / 重复 / 严重违规 |
| NoticeAgent | — | 发帖拒绝通知 |

发帖经 `PostIntentService` → `CreatePostFromChatUseCase` 编排；`ALL_AGENT_TOOLS = []`，**未**接入 `AgentRuntimeService` 工具链。详见 `src/ai/orchestration/README.md`。

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
| **Chroma** | `sync_knowledge`（活动 RAG）、`sync_user_profiles`（用户画像向量，UserProfileAgent 同步） |

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
- ~~P1：Registration 物理迁入 ActivityModule~~ ✅ `modules/activity/registration/`
- P5：通知 meta 深链、Partner 目录可选 rename

对照清单：`docs/BACKEND-REFACTOR-CHECKLIST.md`

---

## 测试

单元测试集中在 `test/unit/`（目录与 `src/` 域对应），共享 mock 在 `test/mocks/`。运行 `npm test`；E2E 见 `test/app.e2e-spec.ts` 与 `npm run test:e2e`。说明见 `test/README.md`。
