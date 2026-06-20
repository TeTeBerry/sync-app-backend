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

- `{ activityLegacyId: 1, createdAt: -1 }`（第 2 条）被
  `{ activityLegacyId: 1, status: 1, createdAt: -1 }`（第 4 条）覆盖，
  但 Mongo 仍可分别用于无 `status` 过滤的查询。保留两者，不做删除。

## Post Comments (`post-comment.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 顶级评论分页 `postId + sort(createdAt, _id)` | `post-comment.service.ts` | `postId` 单字段 | 新增 `{ postId: 1, createdAt: 1, _id: 1 }` |
| 楼中楼 `postId + parentCommentId` | `post-comment.service.ts` | `postId` + `parentCommentId` 单字段 | 新增 `{ postId: 1, parentCommentId: 1, createdAt: 1 }` |

## Activity Registrations (`activity-registration.schema.ts`)

| Query 场景 | 查询位置 | 现有索引 | 建议 |
|-----------|-----------|------------|------|
| 唯一注册 `{ userId: 1, activityLegacyId: 1 }` unique | `activity-registration.repository.ts` | 已有 | 保留 |
| Owner 列表 `findByOwner + sort(createdAt)` | `activity-registration.repository.ts` | `userId` 单字段 | 新增 `{ userId: 1, createdAt: -1 }` |
| `findRegisteredUserIds` | `activity-registration.repository.ts` | `activityLegacyId` 单字段 | 保留 |

## 部署建议

- 生产环境使用 `background: true`（Mongoose 5+ 默认 `background: true`）。
- 大集合（posts）上新索引前先用 `explain()` 验证当前查询计划。
- 通过 `db.<collection>.getIndexes()` 和 `db.<collection>.aggregate([{ $indexStats: {} }])` 监控索引使用率。
