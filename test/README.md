# Backend tests

## Layout

| Path | Purpose |
|------|---------|
| `test/unit/` | Unit tests (mirror `src/` domains) |
| `test/mocks/` | Shared Jest module stubs (chromadb, langchain, etc.) |
| `test/app.e2e-spec.ts` | E2E (`npm run test:e2e`, config in `jest-e2e.json`) |

### Unit test tree

```
test/unit/
  ai/              # AiModule, agents, buddy, intent, rag, utils
  common/utils/
  modules/
    notification/
    post/application/
```

Imports use the `@src/...` alias (see `package.json` → `jest.moduleNameMapper`).

## Commands

```bash
npm run check               # typecheck + lint + format:check + unit tests
npm test                    # unit tests (test/unit/**/*.spec.ts)
npm run test:e2e            # e2e
CI=true npm test -- --watchman=false
```

### REST smoke (live server)

Requires a running API (`npm run dev` / `dev:all`):

```bash
npm run smoke:api           # hit http://localhost:3000/api
npm run smoke:api:wait      # wait for :3000, then smoke

# remote / staging
SMOKE_API_BASE=https://your-host/api SMOKE_ACTIVITY_ID=4 npm run smoke:api
```

Script: `scripts/smoke-api.mjs` — health, home, activities, posts, profile, user, register, itinerary (schedule→generate→save→saved), live-info, notifications, optional post like, register cleanup.

Production code lives only under `src/`; specs are not co-located with sources.
