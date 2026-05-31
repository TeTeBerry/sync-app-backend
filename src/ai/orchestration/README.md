# AI orchestration layer

## Production paths

| Flow | Entry | Notes |
|------|-------|-------|
| WS chat turn | `AiChatWsHandler` → `AiService.streamChat` → `AiTurnPipeline` | Intent resolve, buddy flow, match-only, deterministic; `AiSseBuilder` builds `AiStreamEvent` frames sent over WebSocket |
| Posting from chat | `PostIntentService` → `BuddyModule` use cases | Parse → Risk → `PostWriteService.createPost` |
| Match / recommend | `MatchPostsFromChatUseCase` | Chroma + ranking |
| Deterministic replies | `DeterministicReplyService` → `AgentRuntimeService` | Rule handlers only; **no LLM tool runtime for posting** |

Posting **does not** go through `AgentToolsService` or registered `ALL_AGENT_TOOLS`. Those services exist for the deterministic reply handler pipeline (quick replies, slot filling).

## Legacy (deterministic reply only)

Located under `legacy/`:

- `AgentRuntimeService` — used by deterministic reply handlers, not by buddy posting use cases
- `AgentToolsService` — tool registry is empty for posting; handlers may plan tools but none are registered for create/match flows

When adding new posting behavior, extend `BuddyModule` use cases or `PostIntentService`, not the agent tool runtime.
