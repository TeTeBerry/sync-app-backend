# Activity Experience

Activity-scoped features under `/api/activities/:legacyId/*`.

| Subdomain | Module | Nest `@Controller` | HTTP path |
|-----------|--------|-------------------|-----------|
| Travel plan | `travel-plan/` | `activities/:legacyId/travel-plan` | `.../saved`, `save`, `recognize-receipt` |
| Performance itinerary | `itinerary/` | `activities/:legacyId/itinerary` | `.../schedule`, `generate`, `save`, `saved` |
| Travel guide | `travel-guide/` | `activities/:legacyId/travel-guide` | `.../generate`, `.../generate-async` |
| Festival plan | `festival-plan/` | `activities/:legacyId/festival-plan-progress` | `GET` (BFF for AI tab checklist) |

## Dependency rules

```
activity-experience/*  →  infra/llm, infra/chroma, modules/activity, modules/auth
activity-experience/*  ✗  ai/agents, ai/buddy, ai/orchestration (use ports)
ai/*                   →  PartnerAgentPortsModule, ItineraryAgentPortsModule, TravelGuideAgentPortsModule
ai/adapters            →  implements outbound ports (moderation / notification)
```

Shared schemas: `FestivalSession`, `ArtistPerformance` (itinerary + travel-plan).
