# LLM 配置与调用路径

后端固定为 **两把 Key**：混元负责文本，千问 VL 负责识图。开发与生产环境配置相同。

## 环境变量（仅需这些）

```env
# 文本 — 混元 TokenHub（意图 / 解析 / 风控 / Agent）
HUNYUAN_API_KEY=
HUNYUAN_BASE_URL=https://tokenhub.tencentmaas.com/v1
HUNYUAN_TEXT_MODEL=hy3-preview
HUNYUAN_REASONING_EFFORT=no_think   # no_think | low | high（意图/解析/风控等默认）
HUNYUAN_TRAVEL_GUIDE_REASONING_EFFORT=high   # AI 出行攻略润色，默认 high

# 视觉 — 千问 VL（手环 / 截图解析 / 票据识别）
QWEN_API_KEY=
QWEN_VL_MODEL=qwen-vl-plus          # 可省略，默认 qwen-vl-plus

# Agent 专用模型（可选，默认 HUNYUAN_TEXT_MODEL）
# AI_AGENT_MODEL=
```

**不再需要** `QWEN_MODEL`、`QWEN_JSON_MODEL`、`QWEN_RERANK_MODEL` 等 DashScope 文本变量。

## 提供商分工

| 能力 | 实现 | 环境变量 |
|------|------|----------|
| 文本 JSON（意图、解析、风控、画像等） | 混元 OpenAI 兼容 API | `HUNYUAN_*` |
| Agent 工具循环（聊天默认） | 混元 | `HUNYUAN_*` / `AI_AGENT_MODEL` |
| 视觉 JSON（手环、截图、票据） | DashScope 多模态 | `QWEN_API_KEY` + `QWEN_VL_MODEL` |

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
| `QWEN_API_KEY` | 视觉禁用；手环审核不可用（本地可用 `WRISTBAND_AI_SKIP=true` 跳过） |

## 相关文档

- 环境变量表：[README.md](../README.md#环境变量)
- 架构与 Agent 表：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 手环审核：[README.md#手环-ai-审核](../README.md#手环-ai-审核)
