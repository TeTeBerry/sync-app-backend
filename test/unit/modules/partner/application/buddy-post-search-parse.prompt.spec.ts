import { llmParseToBuddyPostSearchParsed } from '@src/modules/partner/application/buddy-post-search-parse.prompt';

describe('buddy-post-search-parse.prompt', () => {
  it('maps LLM output to structured parsed fields without duplicating departure into body terms', () => {
    const parsed = llmParseToBuddyPostSearchParsed({
      departureCity: '杭州',
      searchTerms: ['出发'],
    });

    expect(parsed).toEqual({
      departureCity: '杭州',
      extraKeywords: ['出发'],
    });
  });

  it('keeps body keywords separate from departureCity', () => {
    const parsed = llmParseToBuddyPostSearchParsed({
      departureCity: '上海',
      genre: 'Techno',
      peopleCount: '1',
      preferOpenRecruit: true,
      searchTerms: ['Techno', '同逛'],
    });

    expect(parsed).toEqual({
      departureCity: '上海',
      genre: 'Techno',
      peopleCount: '1',
      preferOpenRecruit: true,
      extraKeywords: ['Techno', '同逛'],
    });
  });

  it('maps preferOpenRecruit from date-range recruit query', () => {
    const parsed = llmParseToBuddyPostSearchParsed({
      departureCity: '上海',
      date: '12.11-12.13',
      peopleCount: '1',
      preferOpenRecruit: true,
      searchTerms: ['12.11', '12.13'],
    });

    expect(parsed?.preferOpenRecruit).toBe(true);
    expect(parsed?.date).toBe('12.11-12.13');
  });
});
