# LLM 配置与调用路径

后端固定为 **两把 Key**：混元负责文本，千问 VL 负责识图。开发与生产环境配置相同。

## 环境变量（仅需这些）

```env
# 文本 — 混元（意图 / 解析 / 风控 / Agent）
HUNYUAN_API_KEY=
HUNYUAN_BASE_URL=https://tokenhub.tencentmaas.com/v1   # 云托管生产填 CloudBase 网关 URL
# HUNYUAN_TEXT_MODEL=hy3-preview                       # 默认 hy3-preview
# HUNYUAN_REASONING_EFFORT=no_think                    # 默认 no_think
# HUNYUAN_TRAVEL_GUIDE_REASONING_EFFORT=high           # 出行攻略润色，默认 high

# 视觉 — 千问 VL（小票 OCR、风控识图等）
QWEN_API_KEY=
# QWEN_VL_MODEL=qwen-vl-plus                           # 默认 qwen-vl-plus

# Agent 专用模型（可选，默认 HUNYUAN_TEXT_MODEL）
# AI_AGENT_MODEL=
```

**不再需要** `QWEN_MODEL`、`QWEN_JSON_MODEL`、`QWEN_RERANK_MODEL` 等 DashScope 文本变量。

## 提供商分工

| 能力 | 实现 | 环境变量 |
|------|------|----------|
| 文本 JSON（意图、解析、风控、画像等） | 混元 OpenAI 兼容 API | `HUNYUAN_*` |
| Agent 工具循环（聊天默认） | 混元 | `HUNYUAN_*` / `AI_AGENT_MODEL` |
| 视觉 JSON（小票、截图、风控识图） | DashScope 多模态 | `QWEN_API_KEY` + `QWEN_VL_MODEL` |

`QWEN_API_KEY` **仅**用于 `LlmService.invokeVisionJson`，不会参与文本生成。

## 代码入口

| 类 | 方法 | 用途 |
|----|------|------|
| `TextLlmClient` | `chat` | 混元文本 / Agent |
| `LlmService` | `invokeText` / `invokeJson` | 业务层文本 JSON |
| `LlmService` | `invokeVisionJson` | 图片 + 提示词 → JSON（千问 VL） |
| `AgentLlmService` | `chatWithTools` | Agent-first 多轮工具调用 |

## 混元 JSON 参数

结构化输出通过 `response_format: { type: 'json_object' }`；混元额外传：

```json
"extra_body": { "chat_template_kwargs": { "reasoning_effort": "no_think" } }
```

由 `HUNYUAN_REASONING_EFFORT` 控制（默认 `no_think`）。**AI 出行攻略**单独使用 `HUNYUAN_TRAVEL_GUIDE_REASONING_EFFORT`（默认 `high`，深度思考）。

## 未配置 Key 时

| 缺失 | 行为 |
|------|------|
| `HUNYUAN_API_KEY` | 文本 LLM 禁用；意图路由走规则快路径；Agent 降级 |
| `QWEN_API_KEY` | 视觉禁用；小票 OCR、风控识图等 VL 能力不可用 |

## Scene-only AI

自 **Scene-only 收口** 起，多轮 WebSocket 聊天栈已移除。用户侧 AI 能力统一经 **`POST /api/ai/scene-run`**（`recruit_search`、`recruit_compose`、`events_knowledge_search`）。

仍保留的 LLM 能力：出行攻略生成、招募帖 AI 搜索/帮写、活动知识检索、发帖风控等非对话 API。

## 相关文档

- 环境变量表：[README.md](../README.md#环境变量)
- 架构与 Agent 表：[ARCHITECTURE.md](./ARCHITECTURE.md)

## 成长计划 Token 监控

- 控制台：云开发控制台 → 生文模型 → 用量（环境 `sync-prd-d7gquj4qk86da9bb2`）
- 成长计划 Token：约 10 亿（一期）/ 10 亿（二期补发）
- 生图额度：1 万～10 万张（二期）
- 告警：用量达 80% / 90% / 100% 时微信官方号自动提醒
- 礼包用尽后备：切资源点套餐，provider 改 `cloudbase`（见 [AI 资源包 FAQ](https://docs.cloudbase.net/ai/ai-inspire-plan)）

### 服务端混元生图（海报背景 / 营销 Instagram 等共用）

- 配置命名空间：`imageGeneration.*`
- 环境变量：
  - `IMAGE_GENERATION_ENABLED=true`
  - `IMAGE_GENERATION_MODEL`（如 `hunyuan-image` 或成长计划模型名）
  - `IMAGE_GENERATION_VERSION=v1.9`（可选）
- 兼容旧名：`POSTER_BACKGROUND_ENABLED` / `POSTER_BACKGROUND_IMAGE_MODEL` / `POSTER_BACKGROUND_IMAGE_VERSION` 仍可作为回退读取
- 鉴权：默认复用 `HUNYUAN_API_KEY`（或 `CLOUDBASE_APIKEY`）；本地备选 `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY`
- 云存储：`CLOUDBASE_ENV_ID`（必填）、`CLOUDBASE_STORAGE_BUCKET`

### 海报 AI 背景

- 接口：`POST /api/poster-backgrounds/generate`
- 场景：`set_vote`（Set 票选海报）、`personality_test`（人格测试海报）
- 实现：共用 `HunyuanImageClient` 生图 → 上传云存储 → Redis 缓存 7 天
- 海报专属缓存：`POSTER_BACKGROUND_CACHE_TTL_SEC`（默认 7 天）
- 未配置或失败时：前端自动回退渐变背景，不影响保存/分享
