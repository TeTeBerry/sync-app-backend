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
npm test                    # unit tests (test/unit/**/*.spec.ts)
npm run test:e2e            # e2e
CI=true npm test -- --watchman=false
```

Production code lives only under `src/`; specs are not co-located with sources.
