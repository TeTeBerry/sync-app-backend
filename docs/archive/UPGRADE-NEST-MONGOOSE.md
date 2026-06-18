# Nest 10 + Mongoose 7 升级说明

> **历史快照**：升级已完成；本文档已归档，回归清单仅供回溯参考。

## 目标版本

| 包 | 版本 |
|----|------|
| Node | **≥ 18.18**（`package.json` `engines`） |
| `@nestjs/common` / `core` / `platform-express` | **^10.4** |
| `@nestjs/config` | **^3.3** |
| `@nestjs/mongoose` | **^10.1** |
| `mongoose` | **^7.8** |
| `rxjs` | **^7.8** |
| TypeScript | **^5.7** |
| Jest | **^29** |

## 代码变更摘要

1. **`app.module.ts`**：移除 Mongoose 5 连接项（`useNewUrlParser`、`useCreateIndex` 等）。
2. **`src/database/schemas/*.ts`**：`XxxDocument` 改为 `HydratedDocument<Xxx>`。
3. **`PostRecord`**：改为 `Post` 纯数据 + `_id`（lean/toObject），不再 extends `PostDocument`。
4. **`.npmrc`**：`legacy-peer-deps=true`（`@langchain/community` 与可选 peer 冲突）。

## 本地命令

```bash
node -v   # >= 18.18
npm install
npm run build
npm test
npm run dev:all   # 需 Mongo + Redis
```

## 回归清单

- [ ] `GET /api/health`
- [ ] `GET /api/home`、活动/帖子 CRUD
- [ ] AI WebSocket `ws://…/api/ai/chat/ws` 一轮对话
- [ ] 行程生成（长超时）
- [ ] `npm run db:reset` seed 正常
