# Scene Agent runtime

| Concern | Owner | Notes |
|---------|-------|-------|
| Single-turn scenes | `SceneRunService` | Dispatches by `scene` id to registered handlers |
| Recruit search | `RecruitSearchSceneHandler` | `PostSearchService` → `insight_line` + `reorder_posts` |
| Recruit compose | `RecruitComposeSceneHandler` | `BuddyPostComposeService` → `candidates` + `disclaimer` |
| Events knowledge | `EventsKnowledgeSearchSceneHandler` | Chroma + rules → `knowledge_card` + `filter_activities` |
| Contracts | `@sync/scene-contracts` | Shared request/response + effect union |
| Frontend | `applySceneEffects` | Maps effects to UI state |

`POST /api/ai/scene-run` is the **only** user-facing AI entry (L1). L2 long tasks (travel guide generate, etc.) stay on dedicated REST endpoints.

When extending AI behavior, add a new `SceneHandler` + effect types in `@sync/scene-contracts` — do not reintroduce WebSocket chat turns.
