import {
  buildFactualScheduleBlock,
  buildItineraryGenerationPrompt,
} from '../../../../src/modules/itinerary/domain/itinerary-prompt.builder';

describe('buildItineraryGenerationPrompt', () => {
  it('includes selected DJs and conflict hints', () => {
    const { system, user } = buildItineraryGenerationPrompt({
      eventMeta: '风暴电音节 深圳站',
      dateKey: 'jun13',
      dateLabel: '6月13日',
      selectedDjNames: ['SLANDER', 'LAYZ'],
      performances: [
        {
          artistId: 'slander',
          artistName: 'SLANDER',
          dateKey: 'jun13',
          dateLabel: '6月13日',
          startMinutes: 1260,
          endMinutes: 1335,
          startTime: '21:00',
          endTime: '22:15',
          stageLabel: 'Bass 区',
          genre: 'Dubstep',
          genreLabel: 'Heaven & Hell',
          stage: 'bass',
        },
      ],
      conflicts: [
        {
          artistIds: ['slander', 'layz'],
          artistNames: ['SLANDER', 'LAYZ'],
          dateKey: 'jun13',
          overlapStart: '21:15',
          overlapEnd: '22:15',
          message: 'overlap warning',
        },
      ],
      chromaHints: ['SLANDER · Bass'],
    });

    expect(system).toContain('禁止编造');
    expect(system).toContain('FACTUAL_SCHEDULE');
    expect(user).toContain('FACTUAL_SCHEDULE');
    expect(user).toContain('风暴电音节 深圳站');
    expect(user).toContain('[slander] SLANDER');
    expect(user).toContain('21:00-22:15');
    expect(user).toContain('overlap warning');
    expect(user).toContain('SLANDER · Bass');
  });

  it('marks empty factual schedule as do-not-fabricate', () => {
    expect(buildFactualScheduleBlock([])).toContain('勿编造');
  });
});
