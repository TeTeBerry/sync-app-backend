# Festival Squad (future backend)

Festival Squad is journey-based traveler matching for Raven (sync-web).

## Status

- **MVP (sync-web):** mock travelers + localStorage Squad Profile + connection requests.
- **This backend:** no live matching APIs yet. Do not wire TripPlan invite-collab as discovery.

## Separation of concerns

| Concept | Role |
|---------|------|
| Festival Squad | Discover compatible strangers by journey overlap |
| TripPlan | Invite-only collab for people who already connected |
| Raven Plan | AI journey generation (`/api/raven/*`) |

## Proposed module (later)

```
packages/festival-squad-contracts/
src/modules/festival-squad/
```

### Suggested public + JWT routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/raven/activities/:legacyId/squad/stats` | Public (rate-limited) | Traveler counts |
| GET | `/api/raven/activities/:legacyId/squad/matches` | JWT or anonymous session | Ranked matches |
| GET/PUT | `/api/festival-squad/profiles/:legacyId` | JWT | Squad profile CRUD |
| POST | `/api/festival-squad/connections` | JWT | Connection request |
| PATCH | `/api/festival-squad/connections/:id` | JWT | Accept / decline / cancel |
| POST | `/api/festival-squad/profiles/:id/report` | JWT | Report |
| POST | `/api/festival-squad/profiles/:id/block` | JWT | Block |

### Auth for sync-web

**MVP (temporary):** email-only sign-in without ownership proof.

- **sync-web:** Postgres `raven_users` + httpOnly `raven_sid` cookie sessions.
  See `sync-web/docs/TEMP_EMAIL_AUTH.md`.
- **Backend:** `POST /api/auth/email-login`, `GET /api/auth/session`, existing
  `POST /api/auth/logout`. User fields: `email`, `emailNormalized`,
  `emailVerifiedAt` (null for this flow), `lastLoginAt`.
- Feature flag: `TEMP_EMAIL_ONLY_AUTH_ENABLED` (prod must set `true` explicitly).
- Capabilities: `src/common/auth/auth-capabilities.ts` — do not scatter
  `emailVerifiedAt` checks. OTP migration sets `emailVerifiedAt` on the same user.

Prefer extending this path to email OTP later (not a separate user table).
SMS via `auth-h5` remains available for mini-program / H5 phone accounts.

### Matching

Keep rule-based scoring (arrival, stay, budget, origin, shared artists, looking-for) server-side. Do not claim ML until a real model exists.

### Safety

Never expose home address, passport, booking codes, phone, payment details, or room numbers in public match payloads.
