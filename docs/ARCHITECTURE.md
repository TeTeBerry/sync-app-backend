# 后端架构（当前实现）

> 目标架构：Gateway → User / Activity / Partner / AiAssistant → 四 Agent → MongoDB / Chroma / Redis  
> **现状**：NestJS **单体**，逻辑分层已对齐目标，**未**拆微服务、**无** JWT 网关。

---

## 模块一览

```
AppModule
├── ConfigModule + MongooseModule
├── RedisModule              # 热度缓存（可选）
├── ActivityModule           # 活动
├── UserModule               # Demo 用户 seed
├── PostModule               # 帖子 ≈ PartnerModule
├── ProfileModule            # 个人页 BFF
├── HomeModule               # 首页 BFF
├── NotificationModule
├── ChatModule               # AI 会话持久化
└── AiModule                 # SSE 对话 + Agent 编排
    ├── AgentsModule         # 四 Agent
    ├── OrchestrationModule  # 状态机 / Handler 管道
    ├── RagModule / ChromaModule
    └── PostIntentService    # 发帖 / 匹配编排
```

| 目标模块 | 代码路径 | 状态 |
|----------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`（Query 身份）✅ |
| Activity | `modules/activity/` | 列表 / 匹配 / 详情 / 报名 ✅ |
| Partner | `modules/post/` | 帖子 CRUD + 互动 ✅ |
| AiAssistant | `ai/` + `modules/chat/` | SSE + Agent ✅ |
| BFF | `home/`、`profile/` | 聚合读 ✅ |

---

## AI 对话流程

`POST /api/ai/chat`（SSE）由 `AiService.streamChat` 处理：

```
用户消息
  → PostIntentService.tryCreatePostFromChat
       → ImageParseAgent | TextParseAgent
       → 活动详情快捷标签（如「组队队友」）+ activityLegacyId：先 delta 展示草稿并等待用户回复「确认发布」
       → RiskAgent
       → PostService.createPost（成功则 SSE post_created + delta）
       → 拒绝则 delta（「组队帖暂未发布 ⚠️」+ 原因）
  → 否则 PostIntentService.tryMatchPostsFromChat
       → MatchAgent（Chroma sync_posts，按活动过滤）
  → 否则 DeterministicReplyService（规则 Handler + 状态机，非自由 ChatGPT）
  → ChatService.saveTurn
```

### 四 Agent（`src/ai/agents/`）

| Agent | 实现 | 说明 |
|-------|------|------|
| TextParseAgent | Qwen-Max `invokeJson` | 文本 → 结构化发帖字段 |
| ImageParseAgent | Qwen-VL `invokeVisionJson` | 截图 → 结构化字段 |
| MatchAgent | Chroma `queryPostsByActivity` | 活动内向量检索 |
| RiskAgent | 规则 + Qwen-Max + 重复帖检测 | spam / 重复 / 严重违规 |

发帖 Agent 经 `PostIntentService` 编排；`ALL_AGENT_TOOLS = []`，**未**接入 `AgentRuntimeService` 工具链。

---

## 数据与基础设施

| 存储 | 用途 |
|------|------|
| **MongoDB** | user, activity, activity-registration, post, post-like, post-comment, post-application, chat, notification |
| **Redis** | `heat:global`、`heat:activity:{legacyId}`（不可用则降级） |
| **Chroma** | `sync_knowledge`（活动 RAG）、`sync_posts`（帖子向量，发帖 upsert / 删帖删除） |

---

## 身份与鉴权

- **当前**：Query `userId` / `authorName` → `demo-owner.util.ts`
- **未实现**：`AuthModule`、`JwtAuthGuard`、`POST /auth/dev`、`POST /auth/wechat`
- AI 请求可带 body `activityLegacyId`；前端另发 Header `X-Activity-Id`（后端 middleware 登录期再统一）

---

## 主要 REST 接口

详见 `sync-app/docs/API.md` 与 `README.md`。

---

## 待办（非阻塞 H5 demo）

- P0：Dev / 微信登录 + JWT
- P1：Registration 物理迁入 ActivityModule（可选；逻辑在 `ActivityRegistrationService`）
- P5：通知 meta 深链、Partner 目录可选 rename

对照清单：`docs/BACKEND-REFACTOR-CHECKLIST.md`
