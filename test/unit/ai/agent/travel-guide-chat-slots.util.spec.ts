import {
  listMissingTravelGuideSlots,
  mergeTravelGuideDraft,
  parseTravelGuideChatMessage,
  travelGuideDraftToForm,
} from '@src/ai/agent/travel-guide-chat-slots.util';

describe('travel-guide-chat-slots.util', () => {
  it('parses departure, headcount and budget from one message', () => {
    const draft = parseTravelGuideChatMessage('上海 2人 舒适');
    expect(draft.departure).toBe('上海');
    expect(draft.headcount).toBe(2);
    expect(draft.budgetTier).toBe('standard');
  });

  it('merges multi-turn drafts and reports missing slots', () => {
    const merged = mergeTravelGuideDraft(
      parseTravelGuideChatMessage('上海'),
      parseTravelGuideChatMessage('2人'),
    );
    expect(listMissingTravelGuideSlots(merged)).toEqual(['budgetTier']);
    expect(travelGuideDraftToForm(merged, 2)).toBeNull();
  });

  it('builds form when slots are complete', () => {
    const draft = mergeTravelGuideDraft(
      { departure: '广州', headcount: 3 },
      { budgetTier: 'economy', selfDrive: true },
    );
    expect(travelGuideDraftToForm(draft, 2)).toEqual({
      departure: '广州',
      departureCity: undefined,
      headcount: 3,
      budgetTier: 'economy',
      selfDrive: true,
      accommodationNights: 2,
    });
  });
});
