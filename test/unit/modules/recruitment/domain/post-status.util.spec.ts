import {
  isPostRecruiting,
  isRecruitmentClosed,
  shouldIndexPostForMatching,
} from '@src/modules/recruitment/domain/post-status.util';

describe('post-status.util (recruitment)', () => {
  it('recruiting is open for matching', () => {
    expect(isPostRecruiting('recruiting')).toBe(true);
    expect(shouldIndexPostForMatching('recruiting')).toBe(true);
    expect(isRecruitmentClosed('recruiting')).toBe(false);
  });

  it('completed closes recruitment for both post kinds', () => {
    expect(isPostRecruiting('completed')).toBe(false);
    expect(isRecruitmentClosed('completed')).toBe(true);
    expect(shouldIndexPostForMatching('completed')).toBe(false);
  });
});
