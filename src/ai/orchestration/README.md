# AI orchestration layer

## Production paths

| Flow | Entry | Notes |
|------|-------|-------|
| WS chat turn | `AiChatWsHandler` → `AiService.streamChat` → `AiTurnPipeline` | Intent resolve, buddy flow, match-only, deterministic; `AiStreamEventBuilder` builds `AiStreamEvent` frames sent over WebSocket |
| Posting from chat | `PostIntentService` → `BuddyModule` use cases | Parse → Risk → `PostWriteService.createPost` |
| Match / recommend | `MatchPostsFromChatUseCase` | Chroma + ranking |
| Deterministic replies | `DeterministicReplyService` → `AgentRuntimeService` | Rule handlers only; **no LLM tool runtime for posting** |

Posting **does not** go through `AgentToolsService` or registered posting tools. `AgentToolsService` exists for the deterministic reply handler pipeline (quick replies, slot filling); the registry is empty for create/match flows.

## Deterministic reply runtime

- `AgentRuntimeService` — rule-based handler pipeline for quick replies (not buddy posting)
- `AgentToolsService` — optional tool execution for handlers; no posting tools registered

When adding new posting behavior, extend `BuddyModule` use cases or `PostIntentService`, not `AgentRuntimeService`.

## Turn dispatch (handlers)

| Layer | Role |
|-------|------|
| `AiTurnPipeline` | Intent resolve, profile sync, dispatch by `routed.kind` |
| `AgentFirstTurnHandler` | `AI_AGENT_MODE=on` tool-calling loop + DJ suggested replies |
| `DjInfoTurnHandler` | Legacy `dj_info` path when agent returns empty |
| `PostingTurnOrchestrator` | Recommend gate + `CreatePostFromChatUseCase` |
| `ChatTurnPolicy` | Shared gates for router, agent-first, and posting skip rules |

## Shared chat contracts

Session persistence and AI both use `src/shared/chat/` (`ChatMessageDto`, `ConversationState`). AI-specific flow helpers remain under `src/ai/conversation/`.
