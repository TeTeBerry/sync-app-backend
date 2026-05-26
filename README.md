# Sync App Backend

NestJS 后端：组队活动、AI 对话 SSE、四 Agent 发帖闭环、Chroma RAG、MongoDB、Redis 热度。

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | NestJS 7 |
| AI | 通义千问（Qwen-Max / Qwen-VL）+ LangChain 文档抽象 |
| Agent | TextParse / ImageParse / Match / Risk（`src/ai/agents/`） |
| 知识库 | Chroma（`sync_knowledge` + `sync_posts`） |
| 存储 | MongoDB |
| 缓存 | Redis（热度，可选） |
| 通信 | SSE（`POST /api/ai/chat`） |

架构说明：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
改造清单：[docs/BACKEND-REFACTOR-CHECKLIST.md](./docs/BACKEND-REFACTOR-CHECKLIST.md)

## 快速开始

```bash
cd sync-app-backend
cp .env.example .env
# 编辑 .env：MONGODB_URI、QWEN_API_KEY

# 推荐：MongoDB + Redis（Docker）+ NestJS
npm run dev:all
```

分步：

```bash
npm run infra:up      # mongo + redis
npm run wait:mongo
npm run start:dev
```

国内 Docker 拉取失败：`npm run infra:up:cn`

服务默认：`http://localhost:3000/api`

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 端口，默认 3000 |
| `MONGODB_URI` | MongoDB 连接串 |
| `REDIS_URL` | Redis（空则跳过，热度用 Mongo 兜底） |
| `QWEN_API_KEY` | 通义 API Key（或 `DASHSCOPE_API_KEY`） |
| `QWEN_MODEL` | 文本模型，默认 `qwen-turbo` |
| `QWEN_VL_MODEL` | 视觉模型，默认 `qwen-vl-plus` |
| `CHROMA_PATH` | Chroma 本地目录，默认 `./chroma_data` |
| `CHROMA_COLLECTION` | 活动知识库，默认 `sync_knowledge` |
| `CHROMA_POSTS_COLLECTION` | 帖子向量，默认 `sync_posts` |

完整示例见 [.env.example](./.env.example)。

## 主要接口

### AI 流式对话

```http
POST /api/ai/chat
Content-Type: application/json
Accept: text/event-stream
X-Activity-Id: 2
```

```json
{
  "messages": [{ "role": "user", "content": "帮我组队 EDC" }],
  "sessionId": "optional",
  "userId": "demo-zara",
  "userName": "Zara Chen",
  "activityLegacyId": 2,
  "image": "data:image/jpeg;base64,..."
}
```

SSE 事件：

```
data: {"type":"delta","content":"..."}
data: {"type":"post_created","postId":"...","activityLegacyId":2}
data: {"type":"done","messageId":"...","sessionId":"..."}
data: {"type":"error","message":"..."}
```

- `post_created`：AI 闭环发帖成功
- 审核拒绝：仅 `delta`（文案含「组队帖暂未发布」），无 `post_created`

### 业务 REST（节选）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/home` | 首页（热度 + 活动列表） |
| GET | `/api/activities` | 活动列表 |
| GET | `/api/activities/:legacyId` | 活动详情 |
| POST/DELETE | `/api/activities/:legacyId/register` | 活动报名 / 取消 |
| GET/POST/PATCH/DELETE | `/api/posts`… | 帖子 CRUD + 点赞/评论/申请 |
| GET/PATCH | `/api/users/me` | 当前用户资料 |
| GET | `/api/profile` | 个人页 BFF |
| POST | `/api/ai/chat` | AI SSE |
| GET | `/api/chat/sessions/:id` | 会话历史 |

完整契约：`sync-app/docs/API.md`

**身份（当前）**：写接口 Query `userId` / `authorName`（demo）。登录 / JWT 未实现。

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
| activity registrations | `ProfileSummaryService` |
| users (demo profile) | `UserService` |
| Chroma 知识库 | `ChromaService.seedIfEmpty` |

## 前端对接

`sync-app/.env`：

```env
TARO_APP_API_BASE_URL=/api
TARO_APP_AI_CHAT_URL=/api/ai/chat
```

H5 devServer 将 `/api` 代理到 `http://localhost:3000/api`。

## 常见问题

### MongoDB 连接失败

1. `docker compose ps` 确认 mongo 为 healthy  
2. `.env` 中 `MONGODB_URI` 与 compose 端口一致  
3. 使用 `npm run dev:all` 而非单独 `start:dev`

### Chroma

默认本地嵌入式（`CHROMA_PATH`），无需 Docker。不可用时 RAG / Match 自动降级。
