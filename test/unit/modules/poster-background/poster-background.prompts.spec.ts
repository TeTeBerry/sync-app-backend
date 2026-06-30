import {
  buildPosterBackgroundCacheKey,
  buildPosterBackgroundPrompt,
} from '../../../../src/modules/poster-background/poster-background.prompts';

describe('poster-background.prompts', () => {
  it('builds recruit_post prompt with activity name', () => {
    const prompt = buildPosterBackgroundPrompt({
      kind: 'recruit_post',
      activityName: 'EDC Korea',
    });
    expect(prompt).toContain('公开组队招募');
    expect(prompt).toContain('EDC Korea');
  });

  it('builds countdown prompt', () => {
    const prompt = buildPosterBackgroundPrompt({
      kind: 'countdown',
      activityName: 'Tomorrowland',
    });
    expect(prompt).toContain('期待感');
    expect(prompt).toContain('Tomorrowland');
  });

  it('builds cache keys for new kinds', () => {
    expect(
      buildPosterBackgroundCacheKey({
        kind: 'recruit_post',
        activityLegacyId: 8,
      }),
    ).toBe('recruit_post:8');
    expect(
      buildPosterBackgroundCacheKey({
        kind: 'countdown',
        activityLegacyId: 12,
      }),
    ).toBe('countdown:12');
  });
});
