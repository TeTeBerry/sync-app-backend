/** Persisted author fields on posts (not the current request actor). */
export interface StoredAuthorRecord {
  userId?: string;
  authorName?: string;
}
