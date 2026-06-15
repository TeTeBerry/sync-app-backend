import { BadRequestException } from '@nestjs/common';
import { ItineraryGenerationService } from '@src/modules/itinerary/itinerary-generation.service';

describe('ItineraryGenerationService', () => {
  const scheduleService = {
    loadPerformances: jest.fn(),
    detectConflicts: jest.fn(),
  };
  const cache = {
    checkRateLimit: jest.fn().mockResolvedValue(true),
    acquireGenerateLock: jest.fn().mockResolvedValue(true),
    releaseGenerateLock: jest.fn(),
    getGenerationCache: jest.fn().mockResolvedValue(null),
    setGenerationCache: jest.fn(),
  };
  const activityService = {
    findByLegacyId: jest.fn(),
  };
  const logModel = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  let service: ItineraryGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ItineraryGenerationService(
      logModel as never,
      activityService as never,
      scheduleService as never,
      cache as never,
    );
  });

  it('rejects generation when official timetable is not published', async () => {
    scheduleService.loadPerformances.mockResolvedValue({
      sessions: [],
      performances: [],
    });

    await expect(
      service.generate({
        activityLegacyId: 5,
        selectedDjIds: ['martin-garrix'],
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
