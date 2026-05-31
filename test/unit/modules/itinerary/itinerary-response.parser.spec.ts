import { parseItineraryGenerationResponse } from '../../../../src/modules/itinerary/domain/itinerary-response.parser';

describe('parseItineraryGenerationResponse', () => {
  it('parses valid LLM payload', () => {
    const parsed = parseItineraryGenerationResponse(
      {
        eventMeta: '风暴电音节',
        days: [
          {
            id: 'jun13',
            label: '6月13日',
            bannerDateLabel: '6月13日',
            items: [
              {
                id: 'a',
                time: '21:00',
                dotColor: 'pink',
                title: 'SLANDER',
                highlighted: true,
                pill: { label: '重点', variant: 'pink' },
              },
            ],
          },
        ],
      },
      'fallback',
    );

    expect(parsed?.eventMeta).toBe('风暴电音节');
    expect(parsed?.days[0].nodeCount).toBe(1);
    expect(parsed?.days[0].items[0].pill?.variant).toBe('pink');
  });

  it('returns null for empty days', () => {
    expect(
      parseItineraryGenerationResponse({ eventMeta: 'x', days: [] }, 'fb'),
    ).toBeNull();
  });
});
