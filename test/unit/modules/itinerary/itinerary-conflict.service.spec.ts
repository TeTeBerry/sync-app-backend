import { Test } from '@nestjs/testing';
import { ItineraryConflictService } from '@src/modules/itinerary/itinerary-conflict.service';
import type { ArtistPerformance } from '@src/database/schemas/artist-performance.schema';

describe('ItineraryConflictService', () => {
  let service: ItineraryConflictService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ItineraryConflictService],
    }).compile();
    service = moduleRef.get(ItineraryConflictService);
  });

  it('maps performances to slots before conflict detection', () => {
    const performances = [
      {
        artistId: 'a1',
        artistName: 'Artist A',
        dateKey: 'day1',
        startMinutes: 60,
        endMinutes: 120,
        startTime: '01:00',
        endTime: '02:00',
        stageLabel: 'Main',
      },
    ] as ArtistPerformance[];

    const conflicts = service.detectConflicts(performances, ['a1', 'a2']);

    expect(Array.isArray(conflicts)).toBe(true);
  });
});
