# Backend test layout

## Layout

| Path | Purpose |
|------|---------|
| `test/unit/` | Unit tests (mirror `src/` domains) |
| `test/contract/` | Frontend–backend shared type contracts (`@sync/*-contracts`) |
| `test/mocks/` | Shared Jest module stubs (chromadb, langchain, etc.) |
| `test/app.e2e-spec.ts` | E2E (`npm run test:e2e`, config in `jest-e2e.json`) |

### Unit test tree (representative)

```
test/unit/
  ai/                    # agents, scene, rag, risk
  auth/
  common/
  modules/
    partner/
      application/       # post-write, buddy-post-write-flow
    itinerary/
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
| `travel-plan-frontend-reexports.contract.spec.ts` | Travel-plan re-exports |
| `travel-plan-merge-parity.contract.spec.ts` | Merge util parity |

### Scene AI 相关用例

| 文件 | 覆盖流程 |
|------|----------|
| `ai/scene/scene-run.service.spec.ts` | scene 路由与校验 |
| `ai/scene/recruit-search.handler.spec.ts` | 招募帖 AI 搜索 |
| `ai/scene/recruit-compose.handler.spec.ts` | 招募帖 AI 帮写 |

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
npm run smoke:api           # full regression (20+ steps)
npm run smoke:api:wait      # wait for :3000, then smoke

npm run smoke:golden        # CI golden path (4 REST steps)
npm run smoke:golden:wait

npm run smoke:suite         # same as smoke:golden (CI merge gate)
npm run smoke:suite:wait    # used by GitHub Actions smoke job

# remote / staging
SMOKE_API_BASE=https://your-host/api SMOKE_ACTIVITY_ID=4 npm run smoke:golden
```

| Script | Coverage |
|--------|----------|
| `scripts/smoke-golden.mjs` | health, activities, ops-seed posts, travel-guide async, scene-run recruit_search |
| `scripts/smoke-api.mjs` | golden steps + itinerary, travel-plan, notifications, reports, … |

Production code lives only under `src/`; specs are not co-located with sources.
