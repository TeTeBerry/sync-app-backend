import {
  buildDevMockTmlBuddyPosts,
  DEV_MOCK_TML_POST_USER_PREFIX,
  TML_THAILAND_LEGACY_ID,
  TML_THAILAND_EVENT_TITLE,
} from '@src/modules/partner/data/dev-mock-buddy-posts.util';
import { isCurrentPersonalityNicknameFormat } from '@src/modules/personality-test/utils/personality-nickname.util';
import { isRaverAvatarAssetKeyInCatalog } from '@src/modules/personality-test/utils/personality-raver-avatar.util';

describe('dev-mock-buddy-posts.util', () => {
  it('builds ten stable TML Thailand mock posts with recruiting and full states', () => {
    const fixedNow = new Date('2026-06-01T12:00:00.000Z');
    const posts = buildDevMockTmlBuddyPosts(fixedNow);

    expect(posts).toHaveLength(10);
    expect(
      posts.every((p) => p.activityLegacyId === TML_THAILAND_LEGACY_ID),
    ).toBe(true);
    expect(posts.every((p) => p.eventTitle === TML_THAILAND_EVENT_TITLE)).toBe(
      true,
    );
    expect(
      posts.every((p) => p.userId.startsWith(DEV_MOCK_TML_POST_USER_PREFIX)),
    ).toBe(true);

    const recruitingBodies = posts.slice(0, 6).map((p) => p.body);
    const fullBodies = posts.slice(6).map((p) => p.body);

    expect(recruitingBodies.every((body) => !/已满|招满|满员/.test(body))).toBe(
      true,
    );
    expect(
      fullBodies.every(
        (body) => /已满|招满/.test(body) && /\d+\s*\/\s*\d+/.test(body),
      ),
    ).toBe(true);

    for (const post of posts) {
      expect(isCurrentPersonalityNicknameFormat(post.authorName)).toBe(true);
      expect(isRaverAvatarAssetKeyInCatalog(post.authorAvatar)).toBe(true);
      expect(post.authorAvatar.startsWith('avatar/')).toBe(true);
      expect(post.tags).toEqual(['#组队']);
      expect(post.body.length).toBeGreaterThan(20);
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
