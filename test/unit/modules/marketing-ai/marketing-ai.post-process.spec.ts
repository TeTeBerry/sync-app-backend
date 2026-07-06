import {
  applyXPostProcess,
  isPromotionalXContent,
  normalizeVisualBrief,
  truncateXContent,
  X_MAX_LENGTH,
} from '../../../../src/modules/marketing-ai/marketing-ai.post-process';

describe('marketing-ai.post-process', () => {
  describe('isPromotionalXContent', () => {
    it('flags marketing phrases', () => {
      expect(isPromotionalXContent('Discover Raven today')).toBe(true);
      expect(isPromotionalXContent('Join Raven for smarter planning')).toBe(
        true,
      );
      expect(isPromotionalXContent('Sign up now for early access')).toBe(true);
    });

    it('allows founder-style insights', () => {
      expect(
        isPromotionalXContent(
          'Festival trips fix the event — everything around it is chaos.',
        ),
      ).toBe(false);
    });
  });

  describe('truncateXContent', () => {
    it('truncates beyond 280 characters', () => {
      const truncated = truncateXContent('x'.repeat(300));
      expect(truncated.length).toBeLessThanOrEqual(X_MAX_LENGTH);
    });
  });

  describe('applyXPostProcess', () => {
    it('clears hashtags and cta and forces text-only visual', () => {
      const result = applyXPostProcess(
        {
          title: 'Marketing title',
          content: 'A calm founder observation about festival logistics.',
          hashtags: ['raven', 'startup'],
          cta: 'Try Raven',
          visualBrief: { visualType: 'single-image' },
        },
        'founder-build-in-public',
      );

      expect(result.hashtags).toEqual([]);
      expect(result.cta).toBe('');
      expect(result.title).toBe('');
      expect(result.contentStyle).toBe('founder-build-in-public');
      expect(result.visualBrief).toEqual({ visualType: 'text-only' });
    });
  });

  describe('normalizeVisualBrief', () => {
    it('requires instagram carousel brief defaults', () => {
      const brief = normalizeVisualBrief(
        'instagram',
        {
          visualBrief: {
            visualType: 'carousel',
            imagePrompt: 'Premium festival carousel',
          },
        },
        {},
      );

      expect(brief).toMatchObject({
        visualType: 'carousel',
        aspectRatio: '4:5',
        imagePrompt: 'Premium festival carousel',
      });
    });

    it('forces reddit text-only', () => {
      expect(
        normalizeVisualBrief(
          'reddit',
          { visualBrief: { visualType: 'carousel' } },
          {},
        ),
      ).toEqual({ visualType: 'text-only' });
    });
  });
});
