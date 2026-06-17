import { isTicketResaleIntent } from '@src/ai/buddy/activity-scope-guard.util';

const ASOT_HK_TICKET =
  '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～';

describe('activity-scope-guard.util', () => {
  describe('isTicketResaleIntent', () => {
    it('detects折价出票 ASOT Hong Kong example', () => {
      expect(isTicketResaleIntent(ASOT_HK_TICKET)).toBe(true);
    });

    it('does not treat buddy search as ticket resale', () => {
      expect(isTicketResaleIntent('13A区有姐妹吗，求组队')).toBe(false);
    });
  });
});
