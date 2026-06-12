/** Nest static `/uploads` — local dev only; CloudBase Run production uses `cloud://` fileIDs. */
export function isLegacyLocalUploadEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ENABLE_LOCAL_UPLOADS === 'true';
  }
  return process.env.ENABLE_LOCAL_UPLOADS !== 'false';
}
