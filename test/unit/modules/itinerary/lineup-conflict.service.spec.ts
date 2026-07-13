import { ClashResolutionService } from '@src/modules/itinerary/clash-resolution.service';
import { LineupConflictService } from '@src/modules/itinerary/lineup-conflict.service';
import { ScheduleOverlapService } from '@src/modules/itinerary/schedule-overlap.service';
import { StageTransferService } from '@src/modules/itinerary/stage-transfer.service';
import type { ClashPerformance } from '@src/modules/itinerary/domain/lineup-conflict.util';

describe('Lineup conflict services', () => {
  const day = '2026-07-18';
  const performances: ClashPerformance[] = [
    {
      artistId: 'a',
      artistName: 'Alpha',
      dateKey: day,
      stageLabel: 'Main',
      startTime: '22:00',
      endTime: '23:00',
      startMinutes: 22 * 60,
      endMinutes: 23 * 60,
    },
    {
      artistId: 'b',
      artistName: 'Beta',
      dateKey: day,
      stageLabel: 'Warehouse',
      startTime: '22:50',
      endTime: '23:50',
      startMinutes: 22 * 60 + 50,
      endMinutes: 23 * 60 + 50,
    },
    {
      artistId: 'c',
      artistName: 'Compatible',
      dateKey: day,
      stageLabel: 'Main',
      startTime: '00:30',
      endTime: '01:30',
      startMinutes: 24 * 60 + 30,
      endMinutes: 25 * 60 + 30,
    },
  ];

  it('picks a compatible alternative that fits the route', () => {
    const stageTransfer = new StageTransferService();
    const overlap = new ScheduleOverlapService();
    const legacy = { detectConflicts: jest.fn() };
    const service = new LineupConflictService(
      { find: jest.fn() } as never,
      stageTransfer,
      overlap,
      legacy as never,
    );

    const alt = service.pickCompatibleAlternative({
      candidates: ['b', 'c'],
      excludeArtistId: 'b',
      selectedArtistIds: ['a'],
      performances,
      schedulePublished: true,
    });
    expect(alt).toBe('c');
  });

  it('marks resolutions needsReview when schedule version changes', async () => {
    const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
    const clashStateModel = {
      updateMany,
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    const itineraryModel = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
      create: jest.fn(),
    };
    const conflicts = {
      loadClashPerformances: jest.fn(),
      getConflictsForLineup: jest.fn(),
    };

    const service = new ClashResolutionService(
      conflicts as never,
      clashStateModel as never,
      itineraryModel as never,
    );

    const result = await service.invalidateForScheduleChange(4, 'sch:1:10:999');
    expect(result.updated).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        activityLegacyId: 4,
        scheduleVersion: { $ne: 'sch:1:10:999' },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'resolutions.$[].needsReview': true,
        }),
      }),
    );
  });

  it('revalidates full day after resolve and rejects stale schedule version', async () => {
    const clashStateModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          deferredArtistIds: [],
          journeyArtistIds: ['a'],
          resolutions: [],
          routeVersion: '1',
          scheduleVersion: 'sch:old',
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
    };
    const itineraryModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          selectedDjIds: ['a', 'b'],
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    };
    const conflicts = {
      loadClashPerformances: jest.fn().mockResolvedValue({
        scheduleVersion: 'sch:new',
        performances,
        schedulePublished: true,
      }),
      getConflictsForLineup: jest.fn().mockResolvedValue({
        scheduleVersion: 'sch:new',
        conflicts: [{ id: 'downstream', type: 'tight-transfer' }],
        summary: { total: 1 },
      }),
    };

    const service = new ClashResolutionService(
      conflicts as never,
      clashStateModel as never,
      itineraryModel as never,
    );

    await expect(
      service.resolve(
        {
          source: 'jwt',
          clientUserId: 'u1',
          displayName: '',
          resolvedUserId: 'u1',
        },
        {
          eventId: 4,
          conflictId: 'partial-clash:day:a:b',
          optionType: 'keep-artist-a',
          artistAId: 'a',
          artistBId: 'b',
          expectedScheduleVersion: 'sch:old',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        scheduleVersion: 'sch:new',
      }),
    });

    conflicts.loadClashPerformances.mockResolvedValue({
      scheduleVersion: 'sch:new',
      performances,
      schedulePublished: true,
    });

    const applied = await service.resolve(
      {
        source: 'jwt',
        clientUserId: 'u1',
        displayName: '',
        resolvedUserId: 'u1',
      },
      {
        eventId: 4,
        conflictId: 'partial-clash:day:a:b',
        optionType: 'keep-artist-a',
        artistAId: 'a',
        artistBId: 'b',
        expectedScheduleVersion: 'sch:new',
        selectedArtistIds: ['a', 'b'],
      },
    );

    expect(applied.journeyUpdated).toBe(true);
    expect(applied.revalidation.conflicts).toHaveLength(1);
    expect(conflicts.getConflictsForLineup).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedArtistIds: ['a', 'b'],
        deferredArtistIds: ['b'],
        journeyArtistIds: ['a'],
      }),
    );
  });
});
