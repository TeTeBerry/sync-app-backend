/**
 * 个人页「获赞数」= 用户名下帖子的 `likes` 之和（不含现场分享帖；与 GET /profile/posts 一致）。
 */
export function sumProfilePostLikes(
  posts: ReadonlyArray<{ likes?: number | null }>,
): number {
  let total = 0;
  for (const post of posts) {
    const value = post.likes;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      total += value;
    }
  }
  return total;
}
