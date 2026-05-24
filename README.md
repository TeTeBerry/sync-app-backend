# Sync App Backend

NestJS 后端：LangChain Agent + Function Calling、Chroma RAG、MongoDB、SSE 流式 AI 对话。

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | NestJS 7 |
| AI | LangChain.js + OpenAI Tools Agent + 通义千问 |
| 知识库 | RAG + Chroma 向量库 |
| 存储 | MongoDB（用户、活动、门票、拼单、聊天记录） |
| 通信 | SSE（`POST /api/ai/chat`） |

## 快速开始

```bash
cd sync-app-backend
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY

# 推荐：一键启动（仅 MongoDB Docker + 等待就绪 + NestJS）
npm run dev:all
```

**国内 Docker Hub 拉取失败（Bad Gateway）时：**

```bash
npm run infra:up:cn    # 使用 DaoCloud 镜像加速
npm run dev
```

或本地安装 MongoDB（不依赖 Docker）：

```bash
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
npm run dev
```

或分步执行：

```bash
npm run infra:up      # 启动 MongoDB + Chroma（Docker）
npm run wait:mongo    # 等待 27017 端口就绪
npm run start:dev     # 启动 NestJS
```

## 常见问题

### Docker 拉镜像 `Bad Gateway`

1. 改用国内镜像：`npm run infra:up:cn`
2. 或在 Docker Desktop → Settings → Docker Engine 添加 registry mirror：
   ```json
   { "registry-mirrors": ["https://docker.m.daocloud.io"] }
   ```
3. Chroma **不需要 Docker**：`.env` 使用 `CHROMA_PATH=./chroma_data`（已默认）

说明 **MongoDB 未在 27017 端口运行**。按顺序排查：

1. `docker compose ps` — 确认 `mongo` 容器状态为 `running (healthy)`
2. 若容器不存在：`npm run infra:up`
3. 若 Docker 拉镜像失败（网络问题），可本地安装 MongoDB：
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community
   ```
4. 确认 `.env` 中 `MONGODB_URI=mongodb://localhost:27017/sync-ai`

**不要** 在 Mongo 未就绪时直接 `npm run start:dev`；请改用 `npm run dev:all` 或 `npm run dev`。

服务默认：`http://localhost:3000/api`

## 环境变量

| 变量 | 说明 |
|------|------|
| `QWEN_API_KEY` | 通义千问 / DashScope API Key |
| `MONGODB_URI` | MongoDB 连接串 |
| `CHROMA_PATH` | Chroma 本地数据目录（默认 `./chroma_data`） |
| `PORT` | 服务端口，默认 3000 |

## 主要接口

### AI 流式对话

```http
POST /api/ai/chat
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "messages": [
    { "role": "assistant", "content": "欢迎语" },
    { "role": "user", "content": "想拼 EDC 门票" }
  ],
  "sessionId": "optional-session-id",
  "userId": "optional-user-id"
}
```

SSE 响应：

```
data: {"type":"delta","content":"正在"}
data: {"type":"done","messageId":"..."}
```

### 业务 REST

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/activities` | 活动列表 |
| GET | `/api/activities/match?keyword=edc` | 活动匹配 |
| GET | `/api/tickets?activityId=edc&type=sell` | 门票挂单 |
| POST | `/api/tickets` | 创建门票挂单 |
| GET | `/api/pindan?activityId=s2o` | 拼单列表 |
| GET | `/api/chat/sessions/:sessionId` | 聊天历史 |
| GET | `/api/home` | 首页聚合数据 |
| POST | `/api/pindan` | 创建拼单 |

活动与拼单字段与前端 `activities.ts` / 拼单页对齐：`legacyId`（1–4）、拼单 `type`（package/hotel/transport）。

## AI Agent 工具

- `queryActivity` — 查询音乐节活动
- `searchTickets` / `createTicketListing` — 搜索/创建门票挂单
- `queryPindan` — 查询开放拼单

RAG 知识库在启动时自动写入 Chroma（EDC / S2O / Ultra、票务与拼单 FAQ）。

## 前端对接

在 Taro 项目 `.env` 中配置：

```
TARO_APP_AI_CHAT_URL=http://localhost:3000/api/ai/chat
```

未配置时前端使用 mock 流式输出。
