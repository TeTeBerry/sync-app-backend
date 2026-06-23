# 后端架构（当前实现）

> 目标架构：Gateway → User / Activity / AiAssistant → MongoDB / Chroma / Redis  
> **现状**：NestJS **单体**，逻辑分层已对齐目标，**未**拆微服务；REST 使用全局 **JWT Guard** + `RequestActor`（见 [AUTH.md](./AUTH.md)）。

---

## 模块一览

```
AppModule
├── ConfigModule + MongooseModule
├── RedisModule              # 热度缓存（可选）
├── infra/llm, infra/chroma  # LLM / 活动知识向量检索
├── ActivityModule           # 活动 + registration/
├── ActivityExperienceModule # travel-plan / itinerary / travel-guide / festival-plan
├── UserModule               # 用户资料、画像同步
├── ProfileModule            # 个人页 BFF（摘要 / 已选活动）
├── HomeModule               # 首页 BFF
├── NotificationModule
├── ChatModule               # AI 会话持久化
├── AccountRiskModule        # 账号风控与限制
├── shared/                  # 前后端契约（chat、travel-plan、itinerary、travel-guide、partner）
└── AiModule                 # WebSocket 对话 + 单轮编排（AiTurnPipeline）
    ├── AgentsModule         # NoticeAgent（活动更新等系统通知）
    ├── OrchestrationModule  # AiTurnPipeline + DeterministicReply
    ├── InfraChromaModule（活动 RAG，经 ActivityModule）
    └── agent/               # ChatAgentOrchestrator（默认 agent-first）
```

| 模块 | 代码路径 | 说明 |
|------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`、画像 hints 同步 |
| Activity | `modules/activity/` | 列表 / 关键词解析 / 详情 / 活动选择记录 |
| AiAssistant | `ai/` + `modules/chat/` | WebSocket + 意图路由 + 确定性回复 |
| BFF | `home/`、`profile/` | 聚合读 |
| ActivityExperience | `modules/activity-experience/` | 活动域 API 聚合（行程 / 攻略 / 计划） |

### 活动域 API（`activities/:legacyId/*`）

| 子域 | 路径 | 说明 |
|------|------|------|
| Travel plan | `travel-plan/` | 行程计划保存、票据识别 |
| Itinerary | `itinerary/` | 电音时间表生成/保存 |
| Travel guide | `travel-guide/` | 高德 POI + 出行攻略生成 |
| Festival plan | `festival-plan-progress` | AI 本场计划进度 BFF |

详见 [`modules/activity-experience/README.md`](../src/modules/activity-experience/README.md)。

### 读端口层

| 模块 / 端口 | 用途 |
|-------------|------|
| `UserRepositoryModule` + `USER_REPOSITORY` | 用户持久化 |
| `ActivityLookupModule` + `ACTIVITY_LOOKUP_PORT` | 活动只读查询；选择记录 / BFF |

> LLM：`infra/llm/InfraLlmModule` — 文本经混元 JSON；视觉经千问 VL。详见 [LLM.md](./LLM.md)。

---

## AI 对话上下文（Strategy A）

- 前端每轮 WS `send` 携带最近 **6 轮**（`CHAT_LLM_CONTEXT_TURNS`）user/assistant 文本，见 `buildLlmChatHistory`。
- 后端 `ChatService.mergeChatHistory(stored.history, dto.messages)` 与 Mongo 持久化合并后，`truncateToRecentTurns(N)` 再送入 `AiTurnPipeline` / Agent。

`ws://<host>/api/ai/chat/ws`（`AiChatWsServer`）将每轮 `send` 交给 `AiService.streamChat`；单轮逻辑在 `AiTurnPipeline`：

```
用户消息
  → AiService：校验、限流、会话合并
  → AiTurnPipeline.runTurn
       → IntentRouterService.resolve（规则快路径 + 可选 LLM JSON）
       → AgentTurnHandler.tryRun（默认：ChatAgent 工具循环）
       → LegacyTurnHandler（agent 关闭或 miss）
            → create_post：PostingTurnOrchestrator
            → activity_enter：活动卡片
            → isDjInfoIntent：DjInfoTurnHandler
            → 其余：DeterministicReplyService（电音节快捷等）
  → AiStreamEventBuilder：delta / client_action / post_created / travel_guide_ready 等
  → AiService：message_complete、ChatService.saveTurn、done
```

**前端对齐能力**：活动绑定与快捷芯片、DJ 信息、出行攻略（agent 工具 + REST 表单）、聊天组队发帖、行程/性格测试/活动选择/评论等 agent 工具与 stream 事件。

### 会话状态机（ConversationState）

持久化在 MongoDB `chat.conversationState`。生产路径：

| flow | 场景 |
|------|------|
| `idle` | 默认：活动咨询、DJ 问答、攻略引导 |
| `collect_post_body` | 用户点「组队发帖」等后填写帖子正文 |
| `publish_confirm` | 草稿待「确认发布」 |

读取时仅将历史 `recommend_gate` 归一为 `idle`。

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
| TextParseAgent | 从聊天提取组队帖草稿 |
| RiskAgent | 发帖文本/图片风控 |
| UserProfileAgent | 发帖时同步城市/风格等画像 |
| NoticeAgent | 活动更新、发帖拒绝等通知 |

---

## 数据与基础设施

| 存储 | 用途 |
|------|------|
| **MongoDB** | user, activity, activity-registration, chat, notification, account-risk-event, posts, travel-guide jobs… |
| **Redis** | `heat:global`、`heat:activity:{legacyId}`（不可用则降级） |
| **Chroma** | `sync_knowledge`（活动 RAG，可选） |

### DB 维护脚本（非启动时执行）

应用启动**不会**自动跑数据迁移。组队帖相关 legacy 清理见 `scripts/migrate-partner-legacy.mjs`：

```bash
npm run db:migrate-partner:dry-run   # 预览
CONFIRM=1 npm run db:migrate-partner # 升级后首次 deploy 前执行一次
```

---

## 身份与鉴权

详见 [AUTH.md](./AUTH.md)。

- **REST**：`JwtAuthGuard` → `req.actor: RequestActor`（受保护路由需 Bearer）
- **AI WebSocket**：`resolveWsChatActor` → `ChatRequestDto.actor`
- **活动上下文**：`ActivityContextMiddleware` / `X-Activity-Id`；与 body `activityLegacyId` 合并

---

## 主要 REST 接口

详见 `sync-app/docs/API.md` 与 `README.md`。

---

## 测试

单元测试：`test/unit/`；`npm test`。说明见 `test/README.md`。

对照清单（历史）：`docs/archive/BACKEND-REFACTOR-CHECKLIST.md`
