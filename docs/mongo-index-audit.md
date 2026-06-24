# Mongo 索引审计

> 生成时间：2026-06-20
> 对照源码 query 与 schema 索引声明，给出 query → index 映射。

## Posts (`post.schema.ts`)

| Query 场景 | 查询位置 | 使用的索引 | 建议 |
|-----------|-----------|------------|------|
| 活动 feed 分页 `findByActivityLegacyIdPage` | `post.repository.ts` | `{ activityLegacyId: 1, status: 1, createdAt: -1 }` 或新增 compound | 新增 `{ activityLegacyId: 1, listedInFeed: 1, status: 1, createdAt: -1, _id: -1 }` 覆盖 `listedInFeed` 过滤 |
| Owner 列表 `findByOwner` / `findByOwnerPage` | `post.repository.ts` | `userId` 单字段 | 新增 `{ userId: 1, createdAt: -1 }` |
| 相似帖扫描 `findOwnerSimilarActivePost` | `post.repository.ts` | `userId` + 内存遍历 | `{ userId: 1, status: 1, createdAt: -1 }` 覆盖 |
| Popular `findPopular` | `post.repository.ts` | `{ status: 1, createdAt: -1 }` | 基本可用；若 `listedInFeed` 过滤上线可扩展 compound |
| `findById` | 多处 | `_id` 主键 | 无需额外索引 |

### 冗余评估

- `{ activityLegacyId: 1, createdAt: -1 }` 已由 `{ activityLegacyId: 1, status: 1, createdAt: -1 }` 与 `activity_feed_compound` 覆盖，**已从 schema 移除**（生产库旧索引可用 `db.posts.dropIndex()` 手动清理）。
- `@Prop({ index: true })` 单字段索引在已有复合索引时冗余，已从 `posts` / `notifications` / `activity_registrations` 移除。

## Post Comments (`post-comment.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 顶级评论分页 `postId + sort(createdAt, _id)` | `post-comment.service.ts` | `postId` 单字段 | 新增 `{ postId: 1, createdAt: 1, _id: 1 }` |
| 楼中楼 `postId + parentCommentId` | `post-comment.service.ts` | `postId` + `parentCommentId` 单字段 | 新增 `{ postId: 1, parentCommentId: 1, createdAt: 1 }` |

## Activity Registrations (`activity-registration.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 唯一注册 `{ userId: 1, activityLegacyId: 1 }` unique | `activity-registration.repository.ts` | 已有 | 保留 |
| Owner 列表 `findByOwner + sort(createdAt)` | `activity-registration.repository.ts` | `registration_owner_list` | 已实现 |
| `findRegisteredUserIds` | `activity-registration.repository.ts` | `registration_activity_broadcast` 前缀 | 已实现 |
| `findWechatActivityUpdateOptInUserIds` | `activity-registration.repository.ts` | `registration_activity_broadcast` | 已实现 |

## Notifications (`notification.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 通知列表 `{ userId }` + `sort(createdAt)` | `notification.service.ts` | `{ userId: 1, createdAt: -1 }` | 保留 |
| 未读列表 / 未读数 / 全部标已读 `{ userId, read: false }` | `notification.service.ts` | `notification_user_unread` | 已实现 |

## Content Reports (`content-report.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 防重复举报 `{ reporterUserId, targetType, targetId }` unique | 举报写入 | 已有 | 保留 |
| 黄牛举报计数 `{ targetUserId, category, createdAt }` | `account-risk.service.ts` | `content_report_target_category` sparse | 已实现 |

## P1 — Travel / Posts / Risk (`2026-06-25`)

| 集合 | 索引名 | 字段 | 覆盖场景 |
|------|--------|------|----------|
| `posts` | `post_owner_activity_active` | `userId + activityLegacyId + status + createdAt` | 用户在某活动的活跃帖检查 |
| `festival_sessions` | `festival_session_activity_sort` | `activityLegacyId + sortOrder` | 行程场次排序加载 |
| `travel_guide_generation_jobs` | `travel_guide_job_dedupe` | `ownerUserId + dedupeKey + status` | 攻略生成任务去重 |
| `travel_guide_generation_jobs` | `travel_guide_job_latest_completed` | `ownerUserId + activityLegacyId + status + updatedAt` | 节日计划最近完成攻略 |
| `travel_guide_saved_plans` | `travel_guide_saved_plan_latest` | `ownerUserId + activityLegacyId + updatedAt` | 用户活动最新攻略 |
| `account_risk_events` | `account_risk_user_severity` | `userId + severity + createdAt` | 高风险事件窗口统计 |

## 部署建议

- 生产环境使用 `background: true`（Mongoose 5+ 默认 `background: true`）。
- 部署后端后 Mongoose 会自动 `createIndex`；也可单独执行 `npm run db:sync-indexes`（读取 `MONGODB_URI`）。
- 大集合（posts）上新索引前先用 `explain()` 验证当前查询计划。
- 通过 `db.<collection>.getIndexes()` 和 `db.<collection>.aggregate([{ $indexStats: {} }])` 监控索引使用率。
