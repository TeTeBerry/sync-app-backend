/**
 * 个人页「获赞数」= 用户名下所有帖子的 `likes` 字段之和（与 GET /profile/posts 列表一致）。
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
