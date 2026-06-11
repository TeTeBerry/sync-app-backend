# PartnerModule

Partner 域模块（`modules/partner/`）：帖子 CRUD、点赞/评论。

REST 路径仍为 `/api/posts`（资源名不变）。

## 结构

- `PostService` — 读列表、详情、属主查询
- `PostInteractionService` — 赞 / 评
- `PartnerWriteModule` — 导出 `PostWriteService`（创建/更新/删帖）
- `PartnerRepositoryModule` — `POST_REPOSITORY` 端口
- `ports/` — `POST_MODERATION_PORT`、`POST_NOTIFICATION_PORT`（由 `PostAgentAdaptersModule` 注入）
