# Activity Experience

Activity-scoped features under `/api/activities/:legacyId/*`.

| Subdomain | Module | Routes |
|-----------|--------|--------|
| Travel plan | `travel-plan/` | `travel-plan/saved`, `save`, `recognize-receipt` |
| Performance itinerary | `itinerary/` | `itinerary/schedule`, `generate`, `save`, `saved` |
| Live info | `live-info/` | `live-info`, wristband, updates |
| Travel guide | `travel-guide/` | `travel-guide` generation |

## Dependency rules

```
activity-experience/*  →  infra/llm, infra/chroma, modules/activity, modules/auth
activity-experience/*  ✗  ai/agents, ai/buddy, ai/orchestration (use ports)
ai/adapters            →  implements ports for activity-experience when AI is needed
```

Shared schemas: `FestivalSession`, `ArtistPerformance` (itinerary + travel-plan).
