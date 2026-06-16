# Backend tests

## Layout

| Path | Purpose |
|------|---------|
| `test/unit/` | Unit tests (mirror `src/` domains) |
| `test/contract/` | Frontend–backend shared type contracts (`@sync/*-contracts`) |
| `test/mocks/` | Shared Jest module stubs (chromadb, langchain, etc.) |
| `test/app.e2e-spec.ts` | E2E (`npm run test:e2e`, config in `jest-e2e.json`) |

### Unit test tree

```
test/unit/
  ai/                    # agents, buddy, intent, orchestration, rag, utils
  auth/
  common/
  modules/
    partner/
      application/       # post-write, buddy-post-write-flow
    itinerary/
    live-info/
    travel-plan/
    travel-guide/
    notification/
    activity/
    user/
    ...
  shared/
```

Imports use the `@src/...` alias (see `package.json` → `jest.moduleNameMapper`).

### Contract tests (`test/contract/`)

| File | Covers |
|------|--------|
| `chat-conversation-state.contract.spec.ts` | Chat state types |
| `chat-ai-stream-event.contract.spec.ts` | WS stream events |
| `chat-frontend-reexports.contract.spec.ts` | Frontend re-export parity |
| `itinerary-frontend-reexports.contract.spec.ts` | Itinerary shared types |
| `live-info-frontend-reexports.contract.spec.ts` | Live-info shared types |
| `travel-plan-frontend-reexports.contract.spec.ts` | Travel-plan re-exports |
| `travel-plan-merge-parity.contract.spec.ts` | Merge util parity |
| `post-mutation.contract.spec.ts` | **已废弃** — 原 Like/comment `{ post }` 契约（帖互动 API 已移除） |

### AI 编排相关用例

| 文件 | 覆盖流程 |
|------|----------|
| `ai/intent/intent-router.rules.spec.ts` | 意图路由（攻略 / 活动进入 / DJ 信息等） |
| `ai/orchestration/ai-turn.pipeline.spec.ts` | 单轮编排（intent → handler → 流式事件） |

## Commands

```bash
npm run check               # typecheck + lint + format:check + unit + contract tests
npm test                    # unit + contract (test/unit/**, test/contract/**)
npm run test:e2e            # e2e
CI=true npm test -- --watchman=false
```

### REST smoke (live server)

Requires a running API (`npm run dev` / `dev:all` or Docker `app`):

```bash
npm run smoke:api           # hit http://localhost:3000/api
npm run smoke:api:wait      # wait for :3000, then smoke

# remote / staging
SMOKE_API_BASE=https://your-host/api SMOKE_ACTIVITY_ID=4 npm run smoke:api
```

Script: `scripts/smoke-api.mjs` — health, home, activities, profile, user, register, itinerary, live-info, notifications, register cleanup.

Production code lives only under `src/`; specs are not co-located with sources.
