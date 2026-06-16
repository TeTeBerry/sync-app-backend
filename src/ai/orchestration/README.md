# AI orchestration

| Concern | Owner | Notes |
|---------|-------|-------|
| Single-turn chat | `AiTurnPipeline` | Intent route → deterministic / DJ handler |
| Streaming events | `AiStreamEventBuilder` | `delta`, `activity_recommendation`, `conversation_patch`, `done` |
| Session state | `ChatService` | MongoDB `conversationState` (`idle` only in production) |

**Removed (2026-06):** `PostIntentService`, `BuddyModule`, posting use cases, `post_created` WS frames.

When extending AI behavior, add handlers under `src/ai/orchestration/handlers/` or extend `DeterministicReplyService` — not a separate posting pipeline.
