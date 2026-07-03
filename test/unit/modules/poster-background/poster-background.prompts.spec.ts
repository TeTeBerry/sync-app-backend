import {
  buildPosterBackgroundCacheKey,
  buildPosterBackgroundPrompt,
} from '../../../../src/modules/poster-background/poster-background.prompts';

describe('poster-background.prompts', () => {
  it('builds trip_plan prompt with activity name', () => {
    const prompt = buildPosterBackgroundPrompt({
      kind: 'trip_plan',
      activityName: 'EDC Korea',
    });
    expect(prompt).toContain('出行行程规划');
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
        kind: 'trip_plan',
        activityLegacyId: 8,
      }),
    ).toBe('trip_plan:8');
    expect(
      buildPosterBackgroundCacheKey({
        kind: 'countdown',
        activityLegacyId: 12,
      }),
    ).toBe('countdown:12');
  });
});
