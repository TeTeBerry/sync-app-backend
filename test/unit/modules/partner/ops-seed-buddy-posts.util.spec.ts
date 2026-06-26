import {
  buildOpsSeedBuddyPosts,
  OPS_SEED_ACTIVITY_LEGACY_IDS,
  OPS_SEED_POST_COUNT,
  OPS_SEED_POST_USER_PREFIX,
} from '@src/modules/partner/data/ops-seed-buddy-posts.util';
import { isCurrentPersonalityNicknameFormat } from '@src/modules/personality-test/utils/personality-nickname.util';
import { isRaverAvatarAssetKeyInCatalog } from '@src/modules/personality-test/utils/personality-raver-avatar.util';

describe('ops-seed-buddy-posts.util', () => {
  it('builds stable ops seed posts across hot activities with US-Q2-16 recruit fields', () => {
    const fixedNow = new Date('2026-06-01T12:00:00.000Z');
    const posts = buildOpsSeedBuddyPosts(fixedNow);

    expect(posts).toHaveLength(OPS_SEED_POST_COUNT);
    expect(posts).toHaveLength(10);
    expect(
      posts.every((p) => p.userId.startsWith(OPS_SEED_POST_USER_PREFIX)),
    ).toBe(true);

    for (const legacyId of OPS_SEED_ACTIVITY_LEGACY_IDS) {
      const activityPosts = posts.filter(
        (p) => p.activityLegacyId === legacyId,
      );
      expect(activityPosts.length).toBeGreaterThanOrEqual(2);
    }

    const recruiting = posts.filter((post) => post.recruitStatus === 'open');
    const full = posts.filter((post) => post.recruitStatus === 'full');

    expect(recruiting.length).toBeGreaterThan(0);
    expect(full.length).toBeGreaterThan(0);
    expect(
      recruiting.every(
        (post) =>
          post.slotsTotal != null &&
          post.slotsFilled != null &&
          post.slotsFilled < post.slotsTotal,
      ),
    ).toBe(true);
    expect(
      full.every(
        (post) =>
          post.slotsTotal != null &&
          post.slotsFilled != null &&
          post.slotsFilled === post.slotsTotal,
      ),
    ).toBe(true);

    for (const post of posts) {
      expect(isCurrentPersonalityNicknameFormat(post.authorName)).toBe(true);
      expect(isRaverAvatarAssetKeyInCatalog(post.authorAvatar)).toBe(true);
      expect(post.authorAvatar.startsWith('avatar/')).toBe(true);
      expect(post.tags).toEqual(['#组队']);
      expect(post.recruitUnityTags?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(post.body).toMatch(/^组队，/);
      expect(post.body).not.toMatch(/已满|招满|满员|招募中｜/);
      expect(post.body.length).toBeGreaterThan(20);
      expect(post.recruitStatus).toMatch(/^(open|full)$/);
      expect(post.slotsTotal).toBeGreaterThan(0);
      expect(post.slotsFilled).toBeGreaterThanOrEqual(0);
      expect(post.createdAt.getTime()).toBeLessThanOrEqual(fixedNow.getTime());
    }

    const again = buildOpsSeedBuddyPosts(fixedNow);
    expect(again.map((p) => p.authorName)).toEqual(
      posts.map((p) => p.authorName),
    );
    expect(again.map((p) => p.authorAvatar)).toEqual(
      posts.map((p) => p.authorAvatar),
    );
    expect(new Set(posts.map((p) => p.authorAvatar)).size).toBeGreaterThan(1);
  });
});
