# AI orchestration

| Concern | Owner | Notes |
|---------|-------|-------|
| Single-turn chat | `AiTurnPipeline` | Agent-first（混元工具循环）→ posting / deterministic / DJ 回退 |
| Streaming events | `AiStreamEventBuilder` | `delta`, `activity_recommendation`, `conversation_patch`, `suggested_replies`, `post_created`, `existing_post`, `done` |
| Session state | `ChatService` | MongoDB `conversationState` (`idle` / `collect_post_body` / `publish_confirm`) |
| Chat posting | `PostingTurnOrchestrator` + `CreatePostFromChatUseCase` | 显式组队意图或确认发布；模板帖走 `POST /posts` |
| Travel guide | `TravelGuideModule` (REST) | 聊天仅引导填槽；生成走 `POST .../travel-guide/generate` |

When extending AI behavior, add handlers under `src/ai/orchestration/handlers/` or extend `DeterministicReplyService` / `quick-reply` handlers.

**Intent routing defaults** (aligned with frontend AI tab):

- Unresolved input → `quick_reply` (活动咨询 / 引导)，**不**默认走发帖
- `create_post` 仅规则/LLM 识别到组队、确认发布、或在 `collect_post_body` / `publish_confirm` 流程中
