import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TravelGuideGenerationCache } from '@src/database/schemas/travel-guide-generation-cache.schema';
import { TravelGuideGenerationCacheService } from '@src/modules/travel-guide/travel-guide-generation-cache.service';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

describe('TravelGuideGenerationCacheService', () => {
  let service: TravelGuideGenerationCacheService;
  const model = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideGenerationCacheService,
        {
          provide: getModelToken(TravelGuideGenerationCache.name),
          useValue: model,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'travelGuide.cache.generationTtlSec' ? 3600 : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideGenerationCacheService);
  });

  it('returns plan when cache entry is not expired', async () => {
    const plan = { activityName: 'Test' } as TravelGuidePlan;
    model.findOne.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve({ plan }),
      }),
    });

    const result = await service.findPlan('cache-key');

    expect(result).toEqual(plan);
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ cacheKey: 'cache-key' }),
    );
  });

  it('returns null when cache entry is missing', async () => {
    model.findOne.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve(null),
      }),
    });

    await expect(service.findPlan('missing')).resolves.toBeNull();
  });

  it('persists plan with ttl expiry', async () => {
    model.updateOne.mockResolvedValue({});

    const params = {
      activityLegacyId: 4,
      departure: '上海虹桥',
      departureCity: '上海市',
      headcount: 2,
      budgetTier: 'standard' as const,
      selfDrive: false,
      accommodationNights: 2,
      note: '',
      locale: 'zh' as const,
    };
    const plan = { activityName: 'Test' } as TravelGuidePlan;

    await service.savePlan('cache-key', 4, params, plan);

    expect(model.updateOne).toHaveBeenCalledWith(
      { cacheKey: 'cache-key' },
      expect.objectContaining({
        $set: expect.objectContaining({
          cacheKey: 'cache-key',
          activityLegacyId: 4,
          requestParams: expect.objectContaining({
            ...params,
            mapDataVersion: 5,
          }),
          plan,
          expiresAt: expect.any(Date),
        }),
      }),
      { upsert: true },
    );
  });
});
