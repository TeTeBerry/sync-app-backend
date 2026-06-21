import {
  buildDevMockTmlBuddyPosts,
  DEV_MOCK_TML_POST_COUNT,
  DEV_MOCK_TML_POST_USER_PREFIX,
  TML_THAILAND_LEGACY_ID,
  TML_THAILAND_EVENT_TITLE,
} from '@src/modules/partner/data/dev-mock-buddy-posts.util';
import { isCurrentPersonalityNicknameFormat } from '@src/modules/personality-test/utils/personality-nickname.util';
import { isRaverAvatarAssetKeyInCatalog } from '@src/modules/personality-test/utils/personality-raver-avatar.util';

describe('dev-mock-buddy-posts.util', () => {
  it('builds stable TML Thailand mock posts with US-Q2-16 recruit fields', () => {
    const fixedNow = new Date('2026-06-01T12:00:00.000Z');
    const posts = buildDevMockTmlBuddyPosts(fixedNow);

    expect(posts).toHaveLength(DEV_MOCK_TML_POST_COUNT);
    expect(
      posts.every((p) => p.activityLegacyId === TML_THAILAND_LEGACY_ID),
    ).toBe(true);
    expect(posts.every((p) => p.eventTitle === TML_THAILAND_EVENT_TITLE)).toBe(
      true,
    );
    expect(
      posts.every((p) => p.userId.startsWith(DEV_MOCK_TML_POST_USER_PREFIX)),
    ).toBe(true);

    const recruiting = posts.filter((post) => post.recruitStatus === 'open');
    const full = posts.filter((post) => post.recruitStatus === 'full');

    expect(recruiting.length).toBeGreaterThan(0);
    expect(full.length).toBeGreaterThanOrEqual(7);
    expect(
      recruiting.every(
        (post) =>
          post.slotsTotal != null &&
          post.slotsFilled != null &&
          post.slotsFilled < post.slotsTotal,
      ),
    ).toBe(true);

    expect(full.every((post) => post.recruitStatus === 'full')).toBe(true);
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
      expect(post.body).toMatch(/^组队，/);
      expect(post.body).not.toMatch(/已满|招满|满员|招募中｜/);
      expect(post.body.length).toBeGreaterThan(20);
      expect(post.recruitStatus).toMatch(/^(open|full)$/);
      expect(post.slotsTotal).toBeGreaterThan(0);
      expect(post.slotsFilled).toBeGreaterThanOrEqual(0);
      expect(post.createdAt.getTime()).toBeLessThanOrEqual(fixedNow.getTime());
    }

    const again = buildDevMockTmlBuddyPosts(fixedNow);
    expect(again.map((p) => p.authorName)).toEqual(
      posts.map((p) => p.authorName),
    );
    expect(again.map((p) => p.authorAvatar)).toEqual(
      posts.map((p) => p.authorAvatar),
    );
    expect(new Set(posts.map((p) => p.authorAvatar)).size).toBeGreaterThan(1);
  });
});
