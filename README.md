# Sync App Backend

NestJS API and AI WebSocket server for **SYNC** — a WeChat mini program for electronic music festival discovery, activity planning, AI assistance, travel guides, itineraries, and structured buddy posts.

## Features

- **Activities** — catalog, detail, keyword resolution, lineup / schedule data
- **Activity selection** — `POST/DELETE /activities/:legacyId/register` records user interest (frontend auto-calls on bind / enter detail; no separate “sign up” flow)
- **Home & profile BFF** — aggregated feeds, heat metrics, selected activities
- **Partner posts** — template buddy posts and comments per activity
- **AI assistant** — WebSocket streaming (`/api/ai/chat/ws`), tool-calling agent (travel guide, itinerary, posting, activity selection, profile, personality test)
- **Travel guide** — Amap POI + LLM-generated trip plans
- **Itinerary** — festival schedule and personalized DJ itineraries
- **Festival plan progress** — BFF for per-activity prep checklist (guide / itinerary / buddy post)
- **Notifications** — in-app + WeChat subscribe messages
- **Account risk** — moderation and posting restrictions

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | NestJS 10 (Node ≥ 18.18, Mongoose 7) |
| AI text | Tencent Hunyuan (`HUNYUAN_API_KEY`) |
| AI vision | Alibaba Qwen VL (`QWEN_API_KEY`) — ticket OCR, image risk |
| Vector RAG | Chroma (`sync_knowledge`, optional) |
| Primary DB | MongoDB |
| Cache | Redis (heat metrics, rate limits; optional) |
| Real-time | WebSocket (`ws://<host>/api/ai/chat/ws`) |
| Auth | JWT + WeChat mini program login |

Architecture details: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
LLM setup: [docs/LLM.md](./docs/LLM.md)  
Auth: [docs/AUTH.md](./docs/AUTH.md)  
Full REST contract: [../sync-app/docs/API.md](../sync-app/docs/API.md)

## Prerequisites

- Node.js **≥ 18.18**
- Docker (MongoDB + Redis for local dev)
- API keys for Hunyuan and Qwen (AI features)

## Quick start

```bash
cd sync-app-backend
# Create .env with MONGODB_URI, HUNYUAN_API_KEY, QWEN_API_KEY, etc. (see Environment variables)
npm install
npm run dev:all        # Docker mongo + redis, then Nest watch mode
```

Service base URL: `http://localhost:3000/api`  
Health check: `GET /api/health`

### Step-by-step

```bash
npm run infra:up       # mongo + redis
npm run infra:chroma   # optional: Chroma on :8000 (--profile chroma)
npm run wait:mongo
npm run start:dev
```

If Docker image pulls fail in China: `npm run infra:up:cn`

### Optional Chroma (activity RAG)

```bash
npm run infra:chroma
# .env: CHROMA_URL=http://localhost:8000
curl -s http://localhost:8000/api/v1/heartbeat
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Infra + wait for Mongo + Nest watch |
| `npm run start:dev` | Nest watch (expects Mongo already up) |
| `npm run build` | Production build |
| `npm run start:prod` | Run `dist/main.js` |
| `npm run check` | typecheck + lint + format + unit tests |
| `npm run smoke:api` | REST smoke against running server |
| `npm run smoke:ws` | AI WebSocket smoke |
| `npm run db:reset` | Clear AI chat history (keeps activity seeds) |
| `npm run db:seed-itinerary` | Seed festival lineup catalog |

See `package.json` for DB maintenance and media scripts.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | **Required** — MongoDB connection string |
| `REDIS_URL` | Redis URL; empty skips Redis (in-memory / Mongo fallbacks) |
| `HUNYUAN_API_KEY` | **Required** for text / agent JSON |
| `HUNYUAN_BASE_URL` | Hunyuan API base; use CloudBase gateway URL in production |
| `QWEN_API_KEY` | Qwen DashScope key for VL / OCR |
| `JWT_SECRET` | **Required in production** (≥ 32 chars) |
| `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET` | WeChat mini program login |
| `AMAP_KEY` | Amap Web API for travel guide POI / routes |
| `CLOUDBASE_ENV_ID` / `CLOUDBASE_STORAGE_BUCKET` | Validate `cloud://` fileIDs from the mini program |
| `CHROMA_URL` | Chroma HTTP base; empty disables RAG |
| `CORS_ORIGINS` | H5 CORS allowlist (comma-separated); mini program can leave empty |
| `AI_AGENT_MODEL` | Chat agent model override |
| `DISABLE_DEV_MOCK_POSTS` | `true` disables dev mock buddy-post seed |

WeChat subscribe-message template field names (`WECHAT_SUBSCRIBE_*`) and more defaults live in `src/config/configuration.ts`.

Local-only uploads: `ENABLE_LOCAL_UPLOADS`, `UPLOAD_DIR`, `UPLOAD_PUBLIC_BASE_URL` — **do not use in production**.

## API overview

### AI chat (WebSocket)

Endpoint: `ws://localhost:3000/api/ai/chat/ws` (use `wss://` in production)

1. Client sends `connect`: `{ "type": "connect", "sessionId?", "activityLegacyId?" }`
2. Server replies `connected`
3. Client sends `send` with `messages`, `activityLegacyId`; images as **`cloud://` fileIDs** (from `wx.cloud.uploadFile`)
4. Server streams JSON frames: `delta`, `message_complete`, `activity_recommendation`, `suggested_replies`, `conversation_patch`, `travel_guide_ready`, `itinerary_ready`, `activity_registered`, `done`, `error`

There is **no** `POST /api/ai/chat` HTTP/SSE endpoint.

### REST (selected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + infra status |
| POST | `/api/auth/wechat` | Mini program login |
| POST | `/api/auth/logout` | Revoke JWT (`tokenVersion` bump) |
| GET | `/api/home` | Home BFF (heat + `signupEvents`) |
| GET | `/api/activities` | Activity catalog |
| GET | `/api/activities/:legacyId` | Activity detail |
| POST/DELETE | `/api/activities/:legacyId/register` | Record / cancel activity selection |
| GET/PATCH | `/api/users/me` | Current user profile |
| GET | `/api/profile` | Profile BFF summary |
| GET | `/api/profile/activities` | User’s selected activities |
| GET | `/api/chat/sessions/:id` | AI session history |

Full contract: [../sync-app/docs/API.md](../sync-app/docs/API.md)

### Authentication

Global `JwtAuthGuard` + `RequestActor` on protected routes. Send `Authorization: Bearer <jwt>`. See [docs/AUTH.md](./docs/AUTH.md).

## Quality assurance

```bash
npm run check
```

CI (`.github/workflows/ci.yml`) runs `check` + `nest build` on PRs and `main`.  
Husky + lint-staged format/lint staged files on commit.

Unit tests: `test/unit/` and `test/contract/`. Details: [test/README.md](./test/README.md)

Workspace-wide check from repo parent: `npm run check:all` (see [../CONTRIBUTING.md](../CONTRIBUTING.md)).

## Deployment

### Docker Compose (server)

Create `.env.production` on the server (**not** committed to git):

```bash
cd sync-app-backend
docker compose up -d --build
docker compose exec app printenv WECHAT_MINI_APP_ID
docker compose exec app printenv REDIS_URL
```

Compose injects `MONGODB_URI` and `REDIS_URL=redis://redis:6379` for the app service.

Optional Chroma profile:

```bash
# .env.production: CHROMA_URL=http://chroma:8000
docker compose --profile chroma up -d --build
```

### Production env checklist

| Variable | Requirement |
|----------|-------------|
| `JWT_SECRET` | ≥ 32 characters, not dev default |
| `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET` | Required |
| `HUNYUAN_API_KEY` | Required |
| `MONGODB_URI` | Reachable from runtime |
| `CORS_ORIGINS` | Optional for mini program-only |

Cloud Run / CloudBase logs: search for `Production configuration invalid` if the container restarts.

## Frontend integration

Configure [../sync-app](../sync-app) (`.env` for local, `.env.production` for release):

```env
TARO_APP_API_BASE_URL=https://sync-backend-prd-xxxx.sh.run.tcloudbase.com/api
TARO_APP_AI_CHAT_WS_URL=wss://sync-backend-prd-xxxx.sh.run.tcloudbase.com/api/ai/chat/ws
TARO_APP_CLOUDBASE_ENV_ID=sync-prd-xxxx
TARO_APP_CLOUD_RUN_SERVICE=sync-backend-prd-xxxx
```

Production mini program uses `wx.cloud.callContainer` and `wx.cloud.connectContainer` instead of direct domain requests.

## Test data

```bash
npm run db:reset
```

Clears MongoDB `chats` collection. Frontend should clear `sessionStorage` key `sync_ai_session` or use a fresh session.

`OnModuleInit` seeds empty collections: activities, demo users, Chroma knowledge (when enabled).

## Troubleshooting

### MongoDB connection failed

1. `docker compose ps` — mongo should be healthy  
2. Match `MONGODB_URI` in `.env` to compose ports  
3. Prefer `npm run dev:all` over bare `start:dev`

### Chroma unavailable

RAG degrades gracefully. Itinerary still uses Mongo lineup data. Check `GET /api/health` → `chroma` field.

### Container back-off restart (Cloud Run)

Usually failed production env validation in `main.ts`. Verify `JWT_SECRET`, WeChat credentials, `HUNYUAN_API_KEY`, and `MONGODB_URI`.

## Related documentation

| Doc | Topic |
|-----|--------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Modules, AI pipeline, data stores |
| [docs/AUTH.md](./docs/AUTH.md) | JWT, WeChat login, actors |
| [docs/LLM.md](./docs/LLM.md) | Hunyuan + Qwen configuration |
| [docs/TRAVEL_GUIDE_MAP.md](./docs/TRAVEL_GUIDE_MAP.md) | Amap integration |
| [../sync-app/docs/API.md](../sync-app/docs/API.md) | Full API contract |
| [docs/archive/](./docs/archive/) | Historical migration notes |

## License

UNLICENSED — private project.
