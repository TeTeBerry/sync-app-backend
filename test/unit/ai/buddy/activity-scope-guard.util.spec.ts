import {
  isActivityScopeMismatch,
  isTicketResaleIntent,
  shouldSkipActivityScopedBuddyRecommend,
} from '@src/ai/buddy/activity-scope-guard.util';

const ASOT_HK_TICKET =
  '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～';

const STORM_SHENZHEN_ACTIVITY = {
  name: '风暴电音节 深圳站',
  date: '06/13-14',
};

describe('activity-scope-guard.util', () => {
  describe('isTicketResaleIntent', () => {
    it('detects折价出票 ASOT Hong Kong example', () => {
      expect(isTicketResaleIntent(ASOT_HK_TICKET)).toBe(true);
    });

    it('does not treat buddy search as ticket resale', () => {
      expect(isTicketResaleIntent('13A区有姐妹吗，求组队')).toBe(false);
    });
  });

  describe('isActivityScopeMismatch', () => {
    it('flags ASOT Hong Kong 6.12 vs Storm Shenzhen', () => {
      expect(
        isActivityScopeMismatch(ASOT_HK_TICKET, STORM_SHENZHEN_ACTIVITY),
      ).toBe(true);
    });

    it('does not flag Storm Shenzhen ticket in same activity context', () => {
      expect(
        isActivityScopeMismatch(
          '临时有事折价出一张6.13深圳风暴内场票',
          STORM_SHENZHEN_ACTIVITY,
        ),
      ).toBe(false);
    });
  });

  describe('shouldSkipActivityScopedBuddyRecommend', () => {
    it('skips buddy recommend for ticket resale in activity chat', () => {
      expect(shouldSkipActivityScopedBuddyRecommend(ASOT_HK_TICKET, 9)).toBe(
        true,
      );
    });

    it('skips ticket resale on homepage without bound activity', () => {
      expect(shouldSkipActivityScopedBuddyRecommend(ASOT_HK_TICKET)).toBe(true);
    });
  });

});
