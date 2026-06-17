# AI orchestration

| Concern | Owner | Notes |
|---------|-------|-------|
| Single-turn chat | `AiTurnPipeline` | **AgentTurnHandler**（默认）→ `LegacyTurnHandler` 回退 |
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

When extending AI behavior, prefer new **ChatAgent tools** or `client_action` affordances over frontend message interception.

**Intent routing** (规则快路径，其余走 Intent LLM 或 `quick_reply` 默认):

- `create_post` — 确认发布、组队发帖入口、转票、活动内 `resolveActivityScopedFastPath`
- `activity_enter` — 首页选活动名回复
- `quick_reply` — 首页音乐节快捷（`DeterministicReplyService` 模板，agent 关闭时）
- DJ / 攻略 / 行程 / 活动 FAQ — **不**规则路由，由 Agent 工具处理；agent 关闭时 DJ 由 `LegacyTurnHandler` + `isDjInfoIntent` 回退

**Agent policy** (`shouldRunAgentFirst`):

- 默认 true（含 DJ、攻略、活动 FAQ）
- 跳过：`create_post` / `activity_enter`、发帖流程、带图、转票、组队快捷
