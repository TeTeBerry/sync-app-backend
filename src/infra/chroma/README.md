# Chroma RAG 知识库设计

活动 Tab `events_knowledge_search` 使用 Chroma 做**语义召回**；Mongo 仍是活动/艺人主库。

## 分层

| 层级 | 来源 | `metadata.topic` | 用途 |
|------|------|------------------|------|
| Catalog 摘要 | `ActivityLookup` 启动同步 | `activity` | 节名/别名/档期/地点/曲风气质 |
| 活动 FAQ | `festival-rag-corpus.data.ts` | `activity` | 阵容要点、易混场区分 |
| 节故事 | 同上 | `story` | Q2-41 品牌背景 |
| 官宣规律 | 同上 | `lineup_hint` | Q2-47 往年节奏（不承诺今年） |
| 生存提示 | 同上 | `survival` | Q2-48 现场/出行一句 |
| DJ 外号 | `dj-chinese-aliases.data.ts` | `dj` | 每条艺人独立 doc，口语检索 |
| 生态/购票 | 全局 snippet | `ecosystem` | 购票渠道说明 |
| 出行通用 | 全局 snippet | `travel` | 签证/出境通用 |

**不进 RAG：** 招募帖、阵容 timetable、用户偏好、实时计数 — 走 Mongo/规则。

## 入库

- 启动：`ChromaCatalogSyncService` → `buildStaticKnowledgeDocuments()` + 全量 catalog `upsert`
- 活动 CRUD：`ActivityService` → `upsertActivityKnowledge`
- 空库首次：`ChromaService.seedIfEmpty()`

文档 id：`{topic}:{code}`，幂等覆盖。

## 检索

`EventsKnowledgeSearchService`：

1. `resolveKnowledgeQueryTopics(query, parsed)` 按意图/问句选 topic 过滤
2. `ChromaService.query(text, 8, { topics })`
3. `mergeChromaActivityHints` 按 `metadata.code` 补活动
4. 模板卡 `appendCuratedChromaSections` 按 topic 分段展示

## 扩展运营数据

编辑 [`data/festival-rag-corpus.data.ts`](data/festival-rag-corpus.data.ts) 中对应 `code` 字段，重启 backend（Chroma 已启用时自动 upsert）。

曲风标签：[`data/festival-vibe.data.ts`](data/festival-vibe.data.ts)（对比卡与 catalog 摘要共用）。

## 环境

```bash
CHROMA_URL=http://localhost:8000   # 本地
CHROMA_URL=http://chroma:8000      # compose 内网
```

未配置时 RAG 禁用，规则路径不受影响。

`ChromaService` 通过 **HTTP API** + `@huggingface/transformers`（MiniLM）在 Node 侧生成向量。生产 Docker 须 **glibc** 基础镜像（`node:20-bookworm-slim`），Alpine 缺少 `ld-linux-x86-64.so.2` 会导致 `onnxruntime-node` 启动失败。

国内网络请设（Transformers 读 `env.remoteHost`，不是 HuggingFace CLI 的 `HF_ENDPOINT` 同名逻辑，但镜像站兼容）：

```env
HF_ENDPOINT=https://hf-mirror.com
```

首次下载约 90MB，缓存目录默认 `./.cache`。

升级后若检索仍为空，清空旧向量库并重启（旧版可能未写入 embedding）：

```bash
docker compose --profile chroma down
docker volume rm sync-app-backend_chroma_data   # 卷名以 docker volume ls 为准
pnpm run dev:all   # 或 npm run dev:all
```
