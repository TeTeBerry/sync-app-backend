# 活动封面图（上传暂存）

线上封面存放在 **CloudBase** `static/activity/`，MongoDB 存 object key，后端 API 返回临时 HTTPS URL。

本目录**不参与运行时读图**，仅在你需要替换/补传封面时，临时放入文件后执行：

```bash
npm run media:upload-activity-images
```

文件名需与 seed 一致，例如 `defqon1.jpg`、`s2o.png`（见 `activity.seed.ts` 的 `image` 字段）。

上传成功后可删除本地文件；云存储与数据库已是唯一来源。
