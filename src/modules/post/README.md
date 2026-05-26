# PostModule

Partner-domain module (`modules/post/` ≈ target **PartnerModule**).

| Service | Responsibility |
|---------|----------------|
| `PostService` | Feed/list queries, CRUD, seed, embedding sync on init |
| `PostInteractionService` | Like, comment, apply, accept application |
| `PostWriteService` | Validate → moderation → create → async Chroma → notification |

REST routes remain on `PostController`; interaction endpoints delegate through `PostService` to `PostInteractionService`.
