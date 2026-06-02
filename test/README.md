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

### 组队发帖相关用例

| 文件 | 覆盖流程 |
|------|----------|
| `modules/partner/application/buddy-post-write-flow.spec.ts` | 活动详情/助手表单 → `POST /posts` → `PostWriteService` |
| `modules/partner/application/post-write.service.spec.ts` | 写帖风控、Chroma、活动帖上限 |
| `modules/partner/utils/post-content-type.util.spec.ts` | `#组队` / `#拼房` 等 → `contentTypes` |
| `ai/buddy/create-post-from-chat.use-case.spec.ts` | WS 聊天：自己发帖、确认、已有帖 |
| `ai/buddy/create-post-from-chat-buddy-publish.spec.ts` | WS 聊天：解析就绪发帖、风控拒绝 |
| `ai/intent/intent-router.rules.spec.ts` | 意图路由（发帖 / 查帖 / 攻略快捷回复） |
| `ai/ai.service.buddy-flow.spec.ts` | `AiService` 端到轮次（推荐门、确认发布） |

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
