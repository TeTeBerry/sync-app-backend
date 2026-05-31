# P0–P3 全栈验收报告

> 验收日期：2026-05-27（复验）  
> 范围：后端 P0–P3 + 前端 AI/活动页/性能优化 + 契约对齐

---

## 总览

| 区域 | 状态 | 说明 |
|------|------|------|
| AI 聊天 WebSocket | ✅ | `ws://…/api/ai/chat/ws`；前后端事件类型一致；delta / message_complete / done 正常 |
| Recommend Gate | ✅ | 后端发 `post_recommendations` + `suggested_replies`；前端 chip 可点 |
| Intent Router | ✅ | 22 套件含 `intent-router.service.spec.ts` 等，规则/LLM/缓存覆盖 |
| Post Create 闭环 | ✅ | `post_created` / `existing_post` / `conversation_patch` 契约对齐 |
| Events UI | ✅ | 活动列表 Tab/卡片；价格与组队热度已移除；按钮「加入」 |
| Search Bar | ✅ | 活动页搜索条为静态占位（无输入框/filter），仅展示样式 |
| 后端测试 | ✅ | **22 suites / 85 tests** 全部通过 |
| 后端构建 | ✅ | `npm run build` |
| 前端类型检查 | ✅ | `npx tsc --noEmit` |
| 前端 H5 构建 | ✅ | `npm run build:h5`（仅有 bundle 体积 warning） |
| 健康检查 | ✅ | `GET /api/health` → `ai.transport=websocket` + mongodb/redis/chroma 快照 |

**结论：验收通过（PASS）** — 构建与测试均绿；契约对齐已代码审阅；冒烟启动成功。

---

## 执行的命令与结果

### 后端

```bash
cd sync-app-backend
CI=true npm test -- --watchman=false   # 22 passed, 85 passed
npm run build                          # exit 0
npm run start:prod                     # 冒烟：Mongo up，Chroma/Redis 可降级
curl http://localhost:3000/api/health  # {"ok":true,"ai":{"transport":"websocket","path":"/api/ai/chat/ws"},"mongodb":"up",...}
```

### 前端

```bash
cd sync-app
npx tsc --noEmit    # exit 0（useAiChatStream.ts 无 TS 错误）
npm run build:h5    # exit 0，2 条 AssetsOverSizeLimitWarning
```

---

## 契约对齐（代码审阅）

### WebSocket 流式事件类型（`AiStreamEvent` JSON 帧）

| 事件 | 后端 `ai-stream-event.view.ts` | 前端 `aiChat.ts` | 前端解析 `aiChatStream.ts` | 前端消费 `useAiChatStream.ts` |
|------|-------------------------------|------------------|---------------------------|------------------------------|
| `delta` | ✅ | ✅ | ✅ | 打字机 append |
| `message_complete` | ✅ | ✅ | ✅ | setFullText |
| `done` | ✅ | ✅ | ✅ | 结束流、持久化 sessionId |
| `post_created` | ✅ | ✅ | ✅ | onPostCreated 回调 |
| `existing_post` | ✅ | ✅ | ✅ | onExistingPost 回调 |
| `post_recommendations` | ✅ (+ `degraded?`) | ✅ (+ `degraded?`) | ✅ | 渲染推荐帖卡片 |
| `suggested_replies` | ✅ | ✅ | ✅ | 渲染快捷 chip |
| `conversation_patch` | ✅ | ✅ | ✅ | `aiChatStore.applyConversationPatch` |
| `error` | ✅ | ✅ | ✅ | 展示错误文案 |

> `conversation_patch` 写入 Zustand `aiChatStore`；持久化仍以服务端 Mongo session 为准。

### 前端近期结构（不影响契约）

- `useAiChatStream` 拆至 `hooks/ai-chat/`
- `aiChatStore` + `navigationStore.activeActivityLegacyId`
- 首屏性能：vendor split、首页 Feed lazy、i18n 按需

### activityLegacyId 传递链

```
活动详情页 event-detail → goAiAssistant({ activityLegacyId, initialMessage })
  → navigationStore.consumeAiAssistantIntent()
  → AiAssistantPage state
  → useAiChatStream({ activityLegacyId })
  → POST body.activityLegacyId + Header X-Activity-Id
```

### Recommend Gate 流程

- 后端：`recommend-gate.util.ts` + `ai.service.buddy-flow.spec.ts`（5 场景：有帖/空帖/拒绝推荐发帖/待确认/确认发布）
- 前端：`AiAssistantPage` 渲染 `recommendedPosts` 卡片 + `suggestedReplies` chip，点击 chip 复用 `send()`

---

## 修复项（本次验收）

| 文件 | 变更 |
|------|------|
| `src/ai/ai.service.buddy-flow.spec.ts` | 增加 `jest.mock('./llm/llm.service')`，避免 Jest 解析 `@langchain/core` ESM |

---

## 已知限制

| 项 | 说明 |
|----|------|
| Chroma | 未设置 `CHROMA_URL` 时 RAG 禁用；向量匹配降级为 Mongo/规则，`post_recommendations.degraded` 可能为 true |
| Redis | 不可用时自动 Mongo fallback；`/api/health` 报告 `redis: disabled` |
| Demo 身份 | 仍使用 query `userId` / demo-owner，无 JWT（P0-H5 后置） |
| LLM | 需配置通义等 API Key；未配置时 intent router 走 rules/default |
| 前端 bundle | H5 `app.js` ~329 KiB，超出 webpack 推荐值（非阻塞） |
| Activity Catalog | 外网 catalog refresh 失败时日志 warning，不影响本地 seed 数据 |

---

## 手动验收步骤（建议用户执行）

1. **启动依赖**：`cd sync-app-backend && npm run infra:up:cn`（Mongo + Redis）；可选 `npm run infra:chroma`
2. **启动后端**：`npm run dev`，确认控制台 `API: http://localhost:3000/api`
3. **启动前端 H5**：`cd sync-app && npm run dev:h5`，浏览器打开本地地址
4. **活动页**：进入「活动」Tab，卡片无价格/热度条，CTA 为「加入」；搜索条为静态占位
5. **活动详情 → AI**：打开任一活动，点击快捷标签（如「找搭子」），应跳转 AI 助手并自动发送首条消息
6. **Recommend Gate**：在活动上下文下发「组队队友」，应看到推荐帖卡片 + 「自己发帖」等 chip；点 chip 应继续对话
7. **发帖闭环**：选择「自己发帖」或描述需求，确认后出现 `post_created` toast，活动帖列表刷新
8. **健康检查**：`curl http://localhost:3000/api/health`，确认 `ai.transport` 为 `websocket`、`mongodb: up` 及 chroma/redis 状态符合预期

---

## 参考文档

- 后端改造清单：`docs/BACKEND-REFACTOR-CHECKLIST.md`
- 前端改造清单：`sync-app/docs/FRONTEND-REFACTOR-CHECKLIST.md`
- API 契约：`sync-app/docs/API.md`
