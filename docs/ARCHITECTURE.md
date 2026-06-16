# 后端架构（当前实现）

> 目标架构：Gateway → User / Activity / AiAssistant → MongoDB / Chroma / Redis  
> **现状**：NestJS **单体**，逻辑分层已对齐目标，**未**拆微服务；REST 使用全局 **JWT Guard** + `RequestActor`（见 [AUTH.md](./AUTH.md)）。  
> **2026-06**：组队帖子（Partner 模块、发帖 Agent、`POST /posts`）已移除；AI 以活动咨询、出行攻略、DJ 信息为主。

---

## 模块一览

```
AppModule
├── ConfigModule + MongooseModule
├── RedisModule              # 热度缓存（可选）
├── infra/llm, infra/chroma  # LLM / 活动知识向量检索
├── ActivityModule           # 活动 + registration/
├── ActivityExperienceModule # travel-plan / itinerary / live-info / travel-guide
├── UserModule               # 用户资料、画像同步
├── ProfileModule            # 个人页 BFF（摘要 / 报名活动）
├── HomeModule               # 首页 BFF
├── NotificationModule
├── ChatModule               # AI 会话持久化
├── AccountRiskModule        # 账号风控与限制
├── shared/                  # 前后端契约（chat、travel-plan、itinerary、live-info）
└── AiModule                 # WebSocket 对话 + 单轮编排（AiTurnPipeline）
    ├── AgentsModule         # NoticeAgent（活动更新等系统通知）
    ├── OrchestrationModule  # AiTurnPipeline + DeterministicReply
    ├── RagModule / InfraChromaModule
    └── agent/               # ChatAgentOrchestrator（可选 shadow 对比）
```

| 模块 | 代码路径 | 说明 |
|------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`、画像 hints 同步 |
| Activity | `modules/activity/` | 列表 / 关键词解析 / 详情 / 报名 |
| AiAssistant | `ai/` + `modules/chat/` | WebSocket + 意图路由 + 确定性回复 |
| BFF | `home/`、`profile/` | 聚合读 |
| ActivityExperience | `modules/activity-experience/` | 四域 API 聚合 |

### 活动域 API（`activities/:legacyId/*`）

| 子域 | 路径 | 说明 |
|------|------|------|
| Travel plan | `travel-plan/` | 行程计划保存、票据识别 |
| Itinerary | `itinerary/` | 电音时间表生成/保存 |
| Live info | `live-info/` | 现场认证、UGC 实况 |
| Travel guide | `travel-guide/` | 高德 POI + 出行攻略生成 |

详见 [`modules/activity-experience/README.md`](../src/modules/activity-experience/README.md)。

### 读端口层

| 模块 / 端口 | 用途 |
|-------------|------|
| `UserRepositoryModule` + `USER_REPOSITORY` | 用户持久化 |
| `ActivityLookupModule` + `ACTIVITY_LOOKUP_PORT` | 活动只读查询；报名 / BFF |

> LLM：`infra/llm/InfraLlmModule` — 文本经混元 JSON；视觉经千问 VL。详见 [LLM.md](./LLM.md)。

---

## AI 对话流程

`ws://<host>/api/ai/chat/ws`（`AiChatWsServer`）将每轮 `send` 交给 `AiService.streamChat`；单轮逻辑在 `AiTurnPipeline`：

```
用户消息
  → AiService：校验、限流、会话合并
  → AiTurnPipeline.runTurn
       → IntentRouterService.resolve（规则快路径 + 可选 LLM JSON）
       → quick_reply / activity_enter / dj_info：DeterministicReply 或专用 Handler
  → AiStreamEventBuilder：delta / activity_recommendation / conversation_patch / suggested_replies 等
  → AiService：message_complete、ChatService.saveTurn、done
```

**已移除**：Partner 模块、发帖编排、`post_created` 流式帧、帖子向量检索、推荐门控、`AiMatchQuota`。

### 会话状态机（ConversationState）

持久化在 MongoDB `chat.conversationState`；当前生产路径仅 `flow: 'idle'`。历史发帖相关 flow 在读取时归一为 `idle`。

### 性能与成本

| 项 | 实现 |
|----|------|
| 限流 | `AiRateLimitService`（Redis 或内存 fallback） |
| 意图缓存 | `IntentCacheService` |
| 流式帧 | `delta` + `message_complete` + `done` |
| 可观测 | `logAiTurn`：`ms_intent` / `ms_buddy` / `ms_total` |

### AgentsModule

| Agent | 说明 |
|-------|------|
| NoticeAgent | 活动更新等系统通知（`ActivityService` 可选注入） |

---

## 数据与基础设施

| 存储 | 用途 |
|------|------|
| **MongoDB** | user, activity, activity-registration, chat, notification, account-risk-event, live-info, travel-guide jobs… |
| **Redis** | `heat:global`、`heat:activity:{legacyId}`（不可用则降级） |
| **Chroma** | `sync_knowledge`（活动 RAG，可选） |

---

## 身份与鉴权

详见 [AUTH.md](./AUTH.md)。

- **REST**：`JwtAuthGuard` → `req.actor: RequestActor`
- **Demo 开发**：`AUTH_ALLOW_DEMO=true` 时 Query `userId` 回退
- **AI WebSocket**：`resolveWsChatActor` → `ChatRequestDto.actor`
- **活动上下文**：`ActivityContextMiddleware` / `X-Activity-Id`；与 body `activityLegacyId` 合并

---

## 主要 REST 接口

详见 `sync-app/docs/API.md` 与 `README.md`。

---

## 测试

单元测试：`test/unit/`；`npm test`。说明见 `test/README.md`。

对照清单：`docs/BACKEND-REFACTOR-CHECKLIST.md`
