import {
  isPostOwnedByActor,
  toRequestActor,
} from '@src/common/auth/actor-query.util';

describe('isPostOwnedByActor', () => {
  it('allows delete when userId matches JWT actor', () => {
    const actor = toRequestActor('wx_user_a', 'Berry');
    const owned = isPostOwnedByActor(
      { userId: 'wx_user_a', authorName: 'Old Name' },
      actor,
      'Berry',
    );
    expect(owned).toBe(true);
  });

  it('allows delete when profile name matches legacy authorName', () => {
    const actor = toRequestActor('wx_user_a', 'JWT Name');
    const owned = isPostOwnedByActor(
      { authorName: 'Berry Chen' },
      actor,
      'Berry',
    );
    expect(owned).toBe(true);
  });

  it('rejects delete for another user', () => {
    const actor = toRequestActor('wx_user_a', 'Berry');
    const owned = isPostOwnedByActor(
      { userId: 'wx_user_b', authorName: 'Other User' },
      actor,
      'Berry',
    );
    expect(owned).toBe(false);
  });
});
