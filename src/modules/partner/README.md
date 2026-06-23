# PartnerModule

Partner 域模块（`modules/partner/`）：帖子创建、列表、评论、删帖。

REST 路径仍为 `/api/posts`（资源名不变）。

## 结构

- `PostService` — 读列表、详情、评论、属主查询
- `PostWriteService` — 创建 / 删帖（`PartnerWriteModule` 导出）
- `PartnerRepositoryModule` — `POST_REPOSITORY` 端口
- `ports/` — `POST_MODERATION_PORT`、`POST_NOTIFICATION_PORT`（由 `PostAgentAdaptersModule` 注入）；`POST_QUERY_PORT`、`POST_WRITE_PORT`（由 `PartnerAgentPortsModule` 导出，供 AI 消费）

## 帖子 HTTP 接口（当前）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/posts/popular` | 热门帖（BFF 可选；前端首页无帖流） |
| GET | `/posts?activityLegacyId=` | 活动帖分页 |
| GET | `/posts` | 当前用户帖子（owner） |
| POST | `/posts` | 创建 |
| DELETE | `/posts/:id` | 删除自己的帖 |
| GET | `/posts/:id/comments` | 评论列表（分页） |
| POST | `/posts/:id/comments` | 发表评论（可选 `parentCommentId` 回复） |
| POST | `/posts/ai-search` | 自然语言搭伴检索 |

**已移除**：`PATCH /posts/:id`、`POST /posts/:id/like`、`GET /posts/:id/navigation-target`

通知深链由前端 `navigateFromNotification` 直接使用通知 `meta.activityLegacyId`，不再调用 `navigation-target`。

## 模板帖正文

同时携带 `tags` 的组队发帖走风控 `{ rulesOnly: true }`。帖子正文 **不得包含任何联系方式**（手机号、微信号、QQ、邮箱、链接等），命中规则直接拒绝发布。落库前会对最终正文再次校验，并走微信 `msg_sec_check` 文本审核。

评论与回复同样执行：**禁联系方式**、票务敏感词拦截、规则风控（`matchRiskRules`）、微信 `msg_sec_check`（`assertUserUgcTexts`），并记录账号风控违规。

详见前端 `sync-app/docs/POST-LIFECYCLE.md`（含 Dev mock 组队帖开关与上架验收）。

