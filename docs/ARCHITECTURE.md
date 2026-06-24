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
├── AccountRiskModule        # 账号风控与限制
├── packages/*-contracts/    # 前后端 workspace 契约包（@sync/*-contracts）
└── AiModule                 # Scene-only AI（POST /ai/scene-run）
    ├── SceneRunModule       # recruit_search / recruit_compose / events_knowledge_search
    ├── AgentsModule         # RiskAgent、NoticeAgent（Partner 发帖风控 / 通知）
    └── PostAgentAdaptersModule  # POST_MODERATION_PORT / POST_NOTIFICATION_PORT
```

| 模块 | 代码路径 | 说明 |
|------|----------|------|
| User | `modules/user/` | `GET/PATCH /users/me`、画像 hints 同步 |
| Activity | `modules/activity/` | 列表 / 关键词解析 / 详情 / 活动选择记录 |
| AiAssistant | `ai/scene/` | 单轮 Scene Agent（`POST /ai/scene-run`） |
| BFF | `home/`、`profile/` | 聚合读 |
| ActivityExperience | `modules/activity-experience/` | 活动域 API 聚合（行程 / 攻略 / 计划） |

### 活动域 API（`activities/:legacyId/*`）

| 子域 | 路径 | 说明 |
|------|------|------|
| Travel plan | `travel-plan/` | 行程计划保存、票据识别 |
| Itinerary | `itinerary/` | 电音时间表生成/保存 |
| Travel guide | `travel-guide/` | 高德 POI + 出行攻略生成 |
| Festival plan | `festival-plan-progress` | AI 本场计划进度 BFF（`@Controller('activities/:legacyId/festival-plan-progress')`） |

详见 [`modules/activity-experience/README.md`](../src/modules/activity-experience/README.md)。

### Workspace 契约包（`packages/*-contracts`）

`@sync/*-contracts` 源码在 `packages/*/`，编译产物同步到 `packages/*/dist`（`npm run build` 的 `postbuild`）。本地 `dist` 已在 `.gitignore`，可随时 `npm run clean:contracts` 清理；下次 `npm run build` 会重建。

### 读端口层

| 模块 / 端口 | 用途 |
|-------------|------|
| `UserRepositoryModule` + `USER_REPOSITORY` | 用户持久化 |
| `ActivityLookupModule` + `ACTIVITY_LOOKUP_PORT` | 活动只读查询；选择记录 / BFF |
| `PartnerReadModule` + `POST_READ_PORT` | 组队帖 BFF 只读（Home / Profile） |
| `PostAgentAdaptersModule` + `POST_MODERATION_PORT` / `POST_NOTIFICATION_PORT` | Partner 发帖风控 / 通知（AI 实现） |

> LLM：`infra/llm/InfraLlmModule` — 文本经混元 JSON；视觉经千问 VL。详见 [LLM.md](./LLM.md)。

---

## Scene-only AI（`POST /ai/scene-run`）

前端通过 [`POST /api/ai/scene-run`](../../sync-app/docs/SCENE-AGENT.md) 发起单轮 AI 任务；后端 `SceneRunService` 按 `scene` 路由到 handler：

| scene | handler | 域服务 |
|-------|---------|--------|
| `recruit_search` | `RecruitSearchSceneHandler` | `PostSearchService` |
| `recruit_compose` | `RecruitComposeSceneHandler` | `BuddyPostComposeService` |
| `events_knowledge_search` | `EventsKnowledgeSearchSceneHandler` | `EventsKnowledgeSearchService` |

响应 `{ effects, disclaimer? }`；前端 `applySceneEffects` 消费 `search_results` / `candidates` 等 effect。

限流：`PublicApiRateLimitService`（`scene_run` key）。详见 [`src/ai/scene/README.md`](../src/ai/scene/README.md)。

### AgentsModule（Partner 发帖链路保留）

| Agent | 说明 |
|-------|------|
| RiskAgent | 发帖文本/图片风控 |
| NoticeAgent | 活动更新、发帖拒绝等通知 |

---

## 数据与基础设施

| 存储 | 用途 |
|------|------|
| **MongoDB** | user, activity, activity-registration, notification, account-risk-event, posts, travel-guide jobs… |
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
- **Scene AI**：`POST /ai/scene-run` 同上，经 `PublicApiRateLimitService` 限流
- **活动上下文**：`ActivityContextMiddleware` / `X-Activity-Id`；与 body `activityLegacyId` 合并

---

## 主要 REST 接口

详见 `sync-app/docs/API.md` 与 `README.md`。

---

## 测试

单元测试：`test/unit/`；`npm test`。说明见 `test/README.md`。

对照清单（历史）：`docs/archive/BACKEND-REFACTOR-CHECKLIST.md`
