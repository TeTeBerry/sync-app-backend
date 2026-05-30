# Profile package tiers (单场) + free monthly quota

## Free tier (all registered users)

Every user receives a **global monthly** quota (UTC calendar month, stored in `user_free_quotas`):

| Benefit | Limit |
|---------|-------|
| AI 智能匹配 | 3 / month |
| 联系方式解锁 | 3 / month |
| 基础组队、发帖、沟通 | **永久免费** (not metered; no package gate) |

Paid per-event tiers are **optional** — free tier is always available.

Fields: `userId`, `period` (`YYYY-MM`), `aiMatchUsed`, `contactUnlockUsed`. Usage resets automatically when `period` ≠ current month.

## Paid tiers (per activity)

Per-activity purchases: **pro**, **pro_plus**, **ultra**. Entitlements are stored in `event_package_entitlements` per `userId` + `activityLegacyId`.

**Validity:** each paid package is valid for **30 calendar days (UTC)** from purchase (`validFrom` / `purchasedAt` → `validUntil`). Tier map days (7 / 15 / 30) apply within that window; `mapExpiresAt` is the earlier of tier map end and `validUntil`. After `validUntil`, paid quotas are inactive (free monthly still applies).

API responses **merge** free monthly remaining + paid per-event remaining for AI match and contact unlock. Map / pin / exposure come from the paid tier only (free users see map as inactive / 0 days).

## Domain

| File | Role |
|------|------|
| `domain/package-tier-id.type.ts` | Paid tier id union + guard |
| `domain/package-tier.config.ts` | Catalog: price, limits, display features |
| `domain/free-tier.config.ts` | Free monthly limits + product notes |
| `domain/free-quota.util.ts` | Period bucket + quota slots |
| `domain/merged-entitlement.util.ts` | Merge free + paid for API |
| `domain/event-entitlement.util.ts` | Quota math, `canConsume*` helpers |
| `domain/mock-profile-user.util.ts` | Zara / demo user detection |

## Persistence

| Collection | Purpose |
|------------|---------|
| `user_free_quotas` | Monthly free usage (`user-free-quota.schema.ts`) |
| `event_package_entitlements` | Per-event paid tier (`event-package-entitlement.schema.ts`) |

Unique indexes: `userId` (free), `(userId, activityLegacyId)` (paid). Re-purchase replaces tier and resets paid usage.

## API (prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile/packages` | Tier catalog for purchase sheet |
| GET | `/profile/entitlements` | Merged entitlements; optional `activityLegacyId` |
| POST | `/profile/packages/purchase` | Stub grant (no WeChat Pay); body `{ tierId, activityLegacyId }` |
| GET | `/profile` | Adds `packageEntitlements[]` or `packageEntitlement` when `activityLegacyId` set |
| POST | `/profile/entitlements/consume/ai-match` | Body `{ activityLegacyId? }` — consumes 1 AI match (free monthly first, then paid per-event) |
| POST | `/profile/entitlements/consume/contact-unlock` | Body `{ activityLegacyId? }` — consumes 1 contact unlock (same bucket order) |

Query identity (demo): `userId`, `authorName` — same as other profile routes.

Consumption returns `{ ok: true, bucket: "free" | "paid", entitlement }` with merged quotas. `403` when exhausted.

### Map / pin / exposure gates (not wired in app yet)

| Benefit | API field | Gate status |
|---------|-----------|---------------|
| 点位地图 | `quotas.map.active` | UI stub — verify `map.active` + `expiresAt` before showing paid map features |
| 帖子置顶 | `quotas.postPin` | Not metered in UI — use `canConsumePostPin` server-side when pin flow ships |
| 基础曝光 | `quotas.basicExposure` | Informational on benefits card; no consume endpoint |

### Entitlement payload (high level)

```json
{
  "activityLegacyId": 4,
  "tierId": "pro",
  "tierName": "Pro",
  "purchasedAt": "2026-05-01T00:00:00.000Z",
  "validFrom": "2026-05-01T00:00:00.000Z",
  "validUntil": "2026-05-31T00:00:00.000Z",
  "quotas": { "aiMatch": { "limit": 11, "used": 0, "remaining": 11 }, "...": "..." },
  "freeMonthly": {
    "period": "2026-05",
    "aiMatch": { "limit": 3, "used": 0, "remaining": 3 },
    "contactUnlock": { "limit": 3, "used": 0, "remaining": 3 }
  },
  "paidTierId": "pro"
}
```

Free-only users: `tierId` / `tierName` = `free` / `免费版`, no `purchasedAt`, `paidTierId` null, `quotas` reflect monthly free only.

## Demo / mock user

On module init, `ProfilePackageService` seeds **pro** for `demo-zara` + `activityLegacyId` 4 (风暴电音节 深圳站). Mock identity: demo `userId`, `authorName` Zara / Zara Chen, or empty query (profile default).

## Services

- `ProfileFreeQuotaService` — load/reset monthly free counters
- `ProfilePackageService` — catalog, list, purchase stub, merge, seed

Consumption: `ProfileEntitlementConsumeService` + `domain/entitlement-consume.util.ts` (`resolve*ConsumeBucket`).
