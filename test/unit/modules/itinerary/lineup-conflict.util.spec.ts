import {
  computeScheduleVersion,
  detectLineupConflicts,
  getArtistScheduleStatus,
  summarizeConflicts,
  type ClashPerformance,
} from '@src/modules/itinerary/domain/lineup-conflict.util';

const day = '2026-07-18';

function slot(
  partial: Partial<ClashPerformance> &
    Pick<
      ClashPerformance,
      'artistId' | 'artistName' | 'startMinutes' | 'endMinutes'
    >,
): ClashPerformance {
  return {
    dateKey: day,
    stageLabel: partial.stageLabel ?? 'Mainstage',
    startTime: partial.startTime ?? '22:00',
    endTime: partial.endTime ?? '23:00',
    ...partial,
  };
}

describe('lineup-conflict.util', () => {
  it('finds no conflict when schedules do not overlap and transfer is comfortable', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'Main',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 30,
          endMinutes: 24 * 60 + 30,
          stageLabel: 'Main',
          startTime: '23:30',
          endTime: '00:30',
        }),
      ],
    });
    expect(conflicts.filter((c) => c.type !== 'schedule-pending')).toHaveLength(
      0,
    );
  });

  it('detects exact / hard overlap', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 22 * 60 + 10,
          endMinutes: 23 * 60 + 10,
          stageLabel: 'Stage B',
        }),
      ],
    });
    expect(conflicts.some((c) => c.type === 'hard-clash')).toBe(true);
    expect(summarizeConflicts(conflicts).hard).toBeGreaterThan(0);
  });

  it('detects contained set overlap as hard or partial', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 24 * 60,
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 22 * 60 + 30,
          endMinutes: 23 * 60,
          stageLabel: 'B',
        }),
      ],
    });
    expect(
      conflicts.some(
        (c) => c.type === 'hard-clash' || c.type === 'partial-clash',
      ),
    ).toBe(true);
  });

  it('detects partial overlap', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 22 * 60 + 50,
          endMinutes: 23 * 60 + 40,
          stageLabel: 'Stage B',
        }),
      ],
    });
    expect(conflicts.some((c) => c.type === 'partial-clash')).toBe(true);
  });

  it('allows adjacent sets on the same stage', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'Main',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 5,
          endMinutes: 24 * 60,
          stageLabel: 'Main',
          startTime: '23:05',
          endTime: '00:00',
        }),
      ],
    });
    expect(conflicts.some((c) => c.type === 'tight-transfer')).toBe(false);
  });

  it('detects insufficient transfer across different stages', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'Mainstage',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 5,
          endMinutes: 24 * 60,
          stageLabel: 'Warehouse',
          startTime: '23:05',
          endTime: '00:00',
        }),
      ],
    });
    expect(conflicts.some((c) => c.type === 'tight-transfer')).toBe(true);
  });

  it('allows sufficient transfer time across different stages', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'Mainstage',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 20,
          endMinutes: 24 * 60 + 20,
          stageLabel: 'Warehouse',
          startTime: '23:20',
          endTime: '00:20',
        }),
      ],
    });
    expect(conflicts.filter((c) => c.type === 'tight-transfer')).toHaveLength(
      0,
    );
  });

  it('uses event default / unknown-stage distance without assuming zero transfer', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      defaultTransferMinutes: 18,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: '',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 10,
          endMinutes: 24 * 60,
          stageLabel: '',
          startTime: '23:10',
          endTime: '00:00',
        }),
      ],
    });
    expect(conflicts.some((c) => c.type === 'tight-transfer')).toBe(true);
    expect(
      conflicts.find((c) => c.type === 'tight-transfer')?.transferMinutes,
    ).toBe(18);
  });

  it('honors stage-pair walking overrides', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      stagePairMinutes: { 'main->warehouse': 4 },
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'Main',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 23 * 60 + 8,
          endMinutes: 24 * 60,
          stageLabel: 'Warehouse',
          startTime: '23:08',
          endTime: '00:00',
        }),
      ],
    });
    // 8 gap >= 4 walk + 3 buffer → not tight
    expect(conflicts.filter((c) => c.type === 'tight-transfer')).toHaveLength(
      0,
    );
  });

  it('marks missing set time as schedule-pending, not fits-route', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
        }),
      ],
    });
    expect(
      conflicts.some(
        (c) => c.type === 'schedule-pending' && c.artistAId === 'b',
      ),
    ).toBe(true);
    expect(
      getArtistScheduleStatus({
        artistId: 'b',
        selectedArtistIds: ['a'],
        performances: [
          slot({
            artistId: 'a',
            artistName: 'Alpha',
            startMinutes: 22 * 60,
            endMinutes: 23 * 60,
          }),
        ],
        schedulePublished: true,
      }),
    ).toBe('schedule-pending');
  });

  it('treats missing timetable as schedule-pending, not fits-route', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a'],
      schedulePublished: false,
      performances: [],
    });
    expect(conflicts.some((c) => c.type === 'schedule-pending')).toBe(true);
    expect(
      getArtistScheduleStatus({
        artistId: 'a',
        selectedArtistIds: ['a'],
        performances: [],
        schedulePublished: false,
      }),
    ).toBe('schedule-pending');
  });

  it('handles cross-midnight sets without false clashes when separated', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 23 * 60,
          endMinutes: 24 * 60 + 30,
          startTime: '23:00',
          endTime: '00:30',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 25 * 60,
          endMinutes: 26 * 60,
          stageLabel: 'Main',
          startTime: '01:00',
          endTime: '02:00',
        }),
      ],
    });
    expect(conflicts.filter((c) => c.type === 'hard-clash')).toHaveLength(0);
  });

  it('uses festival-local absolute minutes (timezone-agnostic continuum)', () => {
    // Times are festival-day minutes, not UTC wall-clock — 25*60 is 01:00 next calendar day.
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 23 * 60 + 50,
          endMinutes: 24 * 60 + 40,
          startTime: '23:50',
          endTime: '00:40',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 24 * 60 + 10,
          endMinutes: 25 * 60,
          stageLabel: 'B',
          startTime: '00:10',
          endTime: '01:00',
        }),
      ],
    });
    expect(
      conflicts.some((c) => c.overlapMinutes && c.overlapMinutes > 0),
    ).toBe(true);
  });

  it('offers split-both only when feasible', () => {
    const partial = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 23 * 60,
          stageLabel: 'A',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 22 * 60 + 45,
          endMinutes: 23 * 60 + 45,
          stageLabel: 'B',
        }),
      ],
    });
    const conflict = partial.find((c) => c.type === 'partial-clash');
    expect(
      conflict?.resolutionOptions.some((o) => o.type === 'split-both'),
    ).toBe(true);
    const split = conflict?.resolutionOptions.find(
      (o) => o.type === 'split-both',
    );
    expect(split?.itineraryImpact.some((w) => (w.missedMinutes ?? 0) > 0)).toBe(
      true,
    );
    expect(split?.transferPlan?.estimatedMinutes).toBeGreaterThan(0);
  });

  it('rejects split-both when remaining watch is below minimum useful duration', () => {
    const conflicts = detectLineupConflicts({
      selectedArtistIds: ['a', 'b'],
      schedulePublished: true,
      performances: [
        slot({
          artistId: 'a',
          artistName: 'Alpha',
          startMinutes: 22 * 60,
          endMinutes: 22 * 60 + 20,
          stageLabel: 'A',
        }),
        slot({
          artistId: 'b',
          artistName: 'Beta',
          startMinutes: 22 * 60 + 5,
          endMinutes: 22 * 60 + 50,
          stageLabel: 'B',
        }),
      ],
    });
    const clash = conflicts.find(
      (c) => c.type === 'hard-clash' || c.type === 'partial-clash',
    );
    expect(clash?.resolutionOptions.some((o) => o.type === 'split-both')).toBe(
      false,
    );
  });

  it('computes stable schedule versions and changes when times change', () => {
    const a = [
      slot({
        artistId: 'a',
        artistName: 'Alpha',
        startMinutes: 22 * 60,
        endMinutes: 23 * 60,
      }),
    ];
    const b = [
      slot({
        artistId: 'a',
        artistName: 'Alpha',
        startMinutes: 22 * 60 + 15,
        endMinutes: 23 * 60 + 15,
      }),
    ];
    const v1 = computeScheduleVersion(a, true);
    const v2 = computeScheduleVersion(a, true);
    const v3 = computeScheduleVersion(b, true);
    expect(v1).toBe(v2);
    expect(v1).not.toBe(v3);
  });

  it('exposes schedule status for recommendation-style conflict surfacing', () => {
    const performances = [
      slot({
        artistId: 'saved',
        artistName: 'Saved',
        startMinutes: 22 * 60,
        endMinutes: 23 * 60,
      }),
      slot({
        artistId: 'rec',
        artistName: 'Recommended',
        startMinutes: 22 * 60 + 10,
        endMinutes: 23 * 60 + 10,
        stageLabel: 'B',
      }),
      slot({
        artistId: 'alt',
        artistName: 'Alt',
        startMinutes: 24 * 60,
        endMinutes: 25 * 60,
        stageLabel: 'Main',
        startTime: '00:00',
        endTime: '01:00',
      }),
    ];
    expect(
      getArtistScheduleStatus({
        artistId: 'rec',
        selectedArtistIds: ['saved'],
        performances,
        schedulePublished: true,
      }),
    ).toBe('hard-clash');
    expect(
      getArtistScheduleStatus({
        artistId: 'alt',
        selectedArtistIds: ['saved'],
        performances,
        schedulePublished: true,
      }),
    ).toBe('fits-route');
  });
});
