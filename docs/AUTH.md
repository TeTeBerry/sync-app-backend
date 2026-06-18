# 身份与鉴权

## 模型

| 概念 | 说明 |
|------|------|
| `RequestActor` | 统一请求身份：`source`（`jwt` \| `anonymous`）、`clientUserId`、`displayName`、`resolvedUserId` |
| REST | 全局 `JwtAuthGuard`；`@Public()` 路由（health、auth、部分活动读）跳过 Guard |
| 受保护路由 | 需 `Authorization: Bearer`；Guard 校验 JWT 并设置 `req.actor` |
| `@Public()` 无 Bearer | `resolveRequestActor` 返回 `anonymous`（空 `resolvedUserId`） |
| Logout | `POST /api/auth/logout`（Bearer）递增 Mongo `user.tokenVersion`；JWT 含 `tv` 声明，与库中版本不一致则 401 |
| AI WebSocket | Upgrade `Authorization` + body 字段 → `resolveWsChatActor` → `ChatRequestDto.actor` |

## 环境变量

| 变量 | 生产建议 | 说明 |
|------|----------|------|
| `JWT_SECRET` | 强随机 | 签名密钥 |
| `JWT_EXPIRES_IN` | `30d` 等 | Token 有效期 |
| `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET` | 必填 | `POST /api/auth/wechat` |

## 生产清单

1. 配置 `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET`
2. 更换 `JWT_SECRET`，勿使用示例值
3. 前端已登录请求只带 `Authorization: Bearer`
4. AI WS：已登录 upgrade 带 Bearer；`send` body 可不传 `userId`/`userName`

## 代码入口

- `src/common/auth/request-actor.types.ts` — 类型
- `src/common/auth/jwt-auth.guard.ts` — 全局 Guard
- `src/common/auth/resolve-request-actor.ts` — `req.actor` → `RequestActor`
- `src/common/auth/actor-query.util.ts` — `toRequestActor`、`ownerFilterFromActor`
- `src/ai/ws/ai-chat-ws-actor.ts` — WebSocket actor

## 遗留边界

- Mongo 文档字段仍为 `userId` / `authorName`（持久化作者）
- `UserService.resolveProfileFromStoredAuthor` — 评论/通知等历史作者展示（`StoredAuthorRecord`）
- Partner `PostModerationPort` 入参为 `RequestActor`（`assessPost`）
