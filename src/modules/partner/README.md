# PartnerModule

Partner 域模块（`modules/partner/`）：帖子创建、列表、删帖。

REST 路径仍为 `/api/posts`（资源名不变）。

## 结构

- `PostService` — 读列表、详情、属主查询
- `PostWriteService` — 创建 / 删帖（`PartnerWriteModule` 导出）
- `PartnerRepositoryModule` — `POST_REPOSITORY` 端口
- `ports/` — `POST_MODERATION_PORT`、`POST_NOTIFICATION_PORT`（由 `PostAgentAdaptersModule` 注入）

## 帖子 HTTP 接口（当前）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/posts/popular` | 热门帖 |
| GET | `/posts?activityLegacyId=` | 活动帖分页 |
| GET | `/posts` | 当前用户帖子（owner） |
| POST | `/posts` | 创建 |
| DELETE | `/posts/:id` | 删除自己的帖 |
| GET | `/posts/:id/navigation-target` | 通知深链 |

**已移除**：`PATCH /posts/:id`、`POST /posts/:id/like`、`GET|POST /posts/:id/comments`

## 模板帖与联系方式

同时携带 `contentTypes` 与 `tags` 的创建请求走风控 `{ rulesOnly: true }`，**不脱敏**正文中的 `联系方式：` 段，供小程序端点击后展示。

详见前端 `sync-app/docs/POST-LIFECYCLE.md`。
