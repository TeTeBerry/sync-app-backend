import { BadRequestException } from '@nestjs/common';
import { LineupDiscoveryService } from '@src/modules/lineup-discovery/lineup-discovery.service';

describe('LineupDiscoveryService.recordSignal validation', () => {
  const tasteSignals = {
    findRecentDuplicate: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({ _id: 'sig1' }),
    mergeAnonymousToUser: jest.fn(),
    aggregateArtistGenreWeights: jest.fn(),
  };
  const scheduleService = { getSchedule: jest.fn() };
  const artistLikes = { getFavoriteArtistIds: jest.fn() };
  const legacyPersonality = {
    migrateIfNeeded: jest.fn(),
    applyLegacyGenreBias: jest.fn(),
  };
  const itineraryModel = { findOne: jest.fn() };
  const lineupConflicts = {
    loadClashPerformances: jest.fn(),
    scheduleCompatibilityFor: jest.fn(),
    getConflictsForLineup: jest.fn(),
    evaluateArtist: jest.fn(),
    pickCompatibleAlternative: jest.fn(),
  };
  const clashResolution = {
    getState: jest.fn(),
    resolve: jest.fn(),
  };

  const service = new LineupDiscoveryService(
    tasteSignals as never,
    scheduleService as never,
    artistLikes as never,
    legacyPersonality as never,
    lineupConflicts as never,
    clashResolution as never,
    itineraryModel as never,
  );

  it('rejects client weight overrides', async () => {
    await expect(
      service.recordSignal(
        {
          signalType: 'artist_saved',
          anonymousId: 'anon_abcdef12',
          artistId: 'a1',
        },
        {
          source: 'anonymous',
          clientUserId: '',
          displayName: '',
          resolvedUserId: '',
        },
        { weight: 99 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported identity without auth or anonymousId', async () => {
    await expect(
      service.recordSignal(
        { signalType: 'artist_viewed' },
        {
          source: 'anonymous',
          clientUserId: '',
          displayName: '',
          resolvedUserId: '',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records anonymous signal with server-assigned weight path', async () => {
    const result = await service.recordSignal(
      {
        signalType: 'artist_saved',
        anonymousId: 'anon_abcdef12',
        artistId: 'a1',
        eventId: '4',
      },
      {
        source: 'anonymous',
        clientUserId: '',
        displayName: '',
        resolvedUserId: '',
      },
    );
    expect(result.recorded).toBe(true);
    expect(tasteSignals.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousId: 'anon_abcdef12',
        signalType: 'artist_saved',
        source: 'behavior',
      }),
    );
  });
});
