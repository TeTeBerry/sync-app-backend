import {
  detectPerformanceConflicts,
  type PerformanceSlot,
} from '../../../../src/modules/itinerary/domain/itinerary-conflict.util';

describe('detectPerformanceConflicts', () => {
  const base: PerformanceSlot[] = [
    {
      artistId: 'slander',
      artistName: 'SLANDER',
      dateKey: 'jun13',
      startMinutes: 21 * 60,
      endMinutes: 22 * 60 + 15,
      startTime: '21:00',
      endTime: '22:15',
      stageLabel: 'Bass 区',
    },
    {
      artistId: 'layz',
      artistName: 'LAYZ',
      dateKey: 'jun13',
      startMinutes: 21 * 60 + 15,
      endMinutes: 22 * 60 + 15,
      startTime: '21:15',
      endTime: '22:15',
      stageLabel: 'Bass 区',
    },
    {
      artistId: 'marshmello',
      artistName: 'Marshmello',
      dateKey: 'jun13',
      startMinutes: 21 * 60,
      endMinutes: 22 * 60 + 30,
      startTime: '21:00',
      endTime: '22:30',
      stageLabel: '主舞台',
    },
  ];

  it('detects overlap between SLANDER and LAYZ', () => {
    const conflicts = detectPerformanceConflicts(base, ['slander', 'layz']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].artistNames).toEqual(['SLANDER', 'LAYZ']);
    expect(conflicts[0].message).toContain('SLANDER');
    expect(conflicts[0].message).toContain('LAYZ');
  });

  it('returns empty when only one selected artist', () => {
    expect(detectPerformanceConflicts(base, ['slander'])).toHaveLength(0);
  });

  it('does not report conflict for non-overlapping selected pair', () => {
    const slots: PerformanceSlot[] = [
      ...base,
      {
        artistId: 'eric-prydz',
        artistName: 'Eric Prydz',
        dateKey: 'jun13',
        startMinutes: 19 * 60 + 30,
        endMinutes: 21 * 60,
        startTime: '19:30',
        endTime: '21:00',
        stageLabel: 'B舞台',
      },
    ];
    expect(
      detectPerformanceConflicts(slots, ['marshmello', 'eric-prydz']),
    ).toHaveLength(0);
  });
});
