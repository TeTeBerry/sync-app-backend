/** Whether a comment row was authored by the post owner (strict userId when available). */
export function isCommentByPostOwner(
  comment: { userId?: string; authorName?: string },
  post: { userId?: string; authorName?: string },
): boolean {
  const postUid = post.userId?.trim();
  const commentUid = comment.userId?.trim();
  if (postUid && commentUid) {
    return postUid === commentUid;
  }

  const postName = post.authorName?.trim() ?? '';
  const commentName = comment.authorName?.trim() ?? '';
  if (!postUid && !commentUid && postName && commentName) {
    return postName === commentName;
  }

  return false;
}
