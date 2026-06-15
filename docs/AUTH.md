# 身份与鉴权

## 模型

| 概念 | 说明 |
|------|------|
| `RequestActor` | 统一请求身份：`source`（`jwt` \| `demo`）、`clientUserId`、`displayName`、`resolvedUserId` |
| REST | 全局 `JwtAuthGuard`；`@Public()` 路由（health、auth、部分活动读）跳过 |
| Demo Query | `AUTH_ALLOW_DEMO=true` 时，无 Bearer 可用 Query `userId` / `authorName`（仅开发） |
| Logout | `POST /api/auth/logout`（Bearer）递增 Mongo `user.tokenVersion`；JWT 含 `tv` 声明，与库中版本不一致则 401 |
| AI WebSocket | Upgrade `Authorization` + body `userId`/`userName` → `resolveWsChatActor` → `ChatRequestDto.actor` |

## 环境变量

| 变量 | 生产建议 | 说明 |
|------|----------|------|
| `JWT_SECRET` | 强随机 | 签名密钥 |
| `JWT_EXPIRES_IN` | `30d` 等 | Token 有效期 |
| `AUTH_MODE` | `wechat` | `dev` 允许 `POST /api/auth/dev`（非 production 亦可用） |
| `AUTH_ALLOW_DEMO` | **`false`** | `true` 时 REST 无 JWT 可走 Query demo 身份 |

## 生产清单

1. `AUTH_ALLOW_DEMO=false`（默认）
2. `AUTH_MODE=wechat`，配置 `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET`
3. 更换 `JWT_SECRET`，勿使用示例值
4. 前端已登录请求只带 `Authorization: Bearer`，不传 demo Query `userId`
5. AI WS：已登录仅 upgrade Bearer；demo/H5 开发在 body 带 `userId`

## 代码入口

- `src/common/auth/request-actor.types.ts` — 类型
- `src/common/auth/jwt-auth.guard.ts` — 全局 Guard
- `src/common/auth/resolve-request-actor.ts` — demo Query 解析
- `src/common/auth/actor-query.util.ts` — `toRequestActor`、`ownerFilterFromActor`
- `src/ai/ws/ai-chat-ws-actor.ts` — WebSocket actor

## 遗留边界

- Mongo 文档字段仍为 `userId` / `authorName`（持久化作者）
- `UserService.resolveProfileFromStoredAuthor` — 评论/通知等历史作者展示（`StoredAuthorRecord`）
- Partner `PostModerationPort` 入参为 `RequestActor`（`assessPost`）
