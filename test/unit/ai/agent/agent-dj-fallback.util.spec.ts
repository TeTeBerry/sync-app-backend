import { isActionableDjQuery } from '@src/ai/agent/agent-dj-fallback.util';

describe('agent-dj-fallback.util', () => {
  it('treats artist_performances with artist as actionable', () => {
    expect(
      isActionableDjQuery({
        intent: 'artist_performances',
        artistName: 'Marshmello',
        styles: [],
        scope: 'catalog',
      }),
    ).toBe(true);
  });

  it('treats artist_discography with artist as actionable', () => {
    expect(
      isActionableDjQuery({
        intent: 'artist_discography',
        artistName: 'Marshmello',
        styles: [],
        scope: 'catalog',
      }),
    ).toBe(true);
  });

  it('rejects empty lineup overview', () => {
    expect(
      isActionableDjQuery({
        intent: 'lineup_overview',
        styles: [],
        scope: 'catalog',
      }),
    ).toBe(false);
  });
});
