/** Persisted author fields on posts/comments (not the current request actor). */
export interface StoredAuthorRecord {
  userId?: string;
  authorName?: string;
}
