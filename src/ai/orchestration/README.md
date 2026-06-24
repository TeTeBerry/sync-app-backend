# AI orchestration

| Concern | Owner | Notes |
|---------|-------|-------|
| Single-turn chat | `AiTurnPipeline` | **ReadOnlyTurnHandler**（规则快路径）→ **AgentTurnHandler**（默认）→ `LegacyTurnHandler` 回退 |
| Legacy fallback | `LegacyTurnHandler` | `create_post` / `activity_enter` / `isDjInfoIntent` → DJ / `DeterministicReplyService` |
| Streaming events | `AiStreamEventBuilder` | `delta`, `activity_recommendation`, `conversation_patch`, `suggested_replies`, `client_action`, `post_created`, `existing_post`, `travel_guide_ready`, `itinerary_ready`, `personality_result_ready`, `activity_registered`, `comment_added`, `done` |
| Session state | `ChatService` | MongoDB `conversationState` (`flow` + `activeTask`) |
| Chat posting | Agent `post_*` tools + `PostingTurnOrchestrator` | 工具封装 `CreatePostFromChatUseCase`；显式组队快捷仍走规则 fast-path |
| Travel guide | Agent `travel_guide_*` tools | 聊天填槽 + `travel_guide_ready`；表单仍走 `client_action` + REST |
| Itinerary | Agent `itinerary_*` tools | 选 DJ → `itinerary_ready`；表单走 `client_action` + 专属行程页 |
| Personality test | Agent `personality_test_*` tools | 读结果 / `personality_result_ready`；测试走 `client_action` |
| Activity register | Agent `activity_register` | `activity_registered` 事件 |
| Profile | Agent `profile_*` tools | 只读摘要 |
| Comments | Agent `post_*_comment` tools | `comment_added` 确认 |

## Scene Run（US-Q2-31）

Stateless HTTP `POST /api/ai/scene-run` — **not** part of the WS chat turn pipeline.

| Concern | Owner | Notes |
|---------|-------|-------|
| Scene dispatch | `SceneRunService` | `scene` → handler registry |
| `recruit_search` | `RecruitSearchSceneHandler` | Wraps `PostSearchService` → `insight_line` + `reorder_posts` effects |
| Contracts | `@sync/scene-contracts` | Shared request/response + effect union |
| Frontend | `applySceneEffects` | Maps effects to UI state (`useEventDetailPostSearch`) |

L0 rule scenes (e.g. `prep_nudge`) can register handlers without LLM. L1 scenes call existing services directly — no `ChatAgentOrchestratorService` loop unless a future scene needs multi-tool agent turns.

When extending AI behavior, prefer new **ChatAgent tools** or `client_action` affordances over frontend message interception.

**Intent routing** (规则快路径，其余走 Intent LLM 或 `quick_reply` 默认):

- `readOnlyFastPath` — 活动已绑定时：`查阵容` / `查演出表` / `生成出行攻略` / `生成专属行程`（chip 文案）→ `ReadOnlyTurnHandler`，跳过 Agent
- `create_post` — 确认发布、组队发帖入口、转票、活动内 `resolveActivityScopedFastPath`
- `activity_enter` — 首页选活动名回复
- `quick_reply` — 首页电音节快捷（`DeterministicReplyService` 模板，agent 关闭时）
- DJ / 攻略 / 行程 / 活动 FAQ — **不**规则路由，由 Agent 工具处理；agent 关闭时 DJ 由 `LegacyTurnHandler` + `isDjInfoIntent` 回退

**Agent policy** (`shouldRunAgentFirst`):

- 默认 true（含 DJ、攻略、活动 FAQ）
- 跳过：`readOnlyFastPath`、`create_post` / `activity_enter`、发帖流程、带图、转票、组队快捷

**只读 Agent 工具** (`terminal: true`)：查询类工具（`query_dj_info`、`get_festival_info`、`get_activity_brief`、`get_schedule`、`profile_*`、`list_comments` 等）返回后结束 tool loop，避免 LLM 重复编造。
