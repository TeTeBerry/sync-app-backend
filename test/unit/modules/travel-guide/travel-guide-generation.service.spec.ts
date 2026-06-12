import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TravelGuideGenerationService } from '@src/modules/travel-guide/travel-guide-generation.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { LlmService } from '@src/infra/llm/llm.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuidePoiCollector } from '@src/modules/travel-guide/map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from '@src/modules/travel-guide/map/travel-guide-poi.ranker';
import { TravelGuideGenerationCacheService } from '@src/modules/travel-guide/travel-guide-generation-cache.service';
import { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import type { TravelGuidePlan } from '@src/modules/travel-guide/domain/travel-guide.types';

const testActor = {
  clientUserId: 'wx_test',
  resolvedUserId: 'wx_test',
  displayName: 'Test',
  source: 'jwt' as const,
};

const cachedPlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: true,
  transport: { title: '交通', lines: ['高铁'] },
  accommodation: { title: '住宿', hotels: [{ name: '酒店A', note: 'n' }] },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
};

describe('TravelGuideGenerationService cache', () => {
  const dto = {
    departure: '上海',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: true,
    accommodationNights: 2,
  };

  let service: TravelGuideGenerationService;
  let findPlan: jest.Mock;
  let savePlan: jest.Mock;
  let collect: jest.Mock;

  beforeEach(async () => {
    findPlan = jest.fn().mockResolvedValue(null);
    savePlan = jest.fn().mockResolvedValue(undefined);
    collect = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideGenerationService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'hunyuan.travelGuideReasoningEffort' ? 'high' : undefined,
          },
        },
        {
          provide: ActivityService,
          useValue: {
            findByLegacyId: jest.fn().mockResolvedValue({
              legacyId: 4,
              name: 'Storm',
              date: '06/13-14',
              location: '深圳',
            }),
          },
        },
        { provide: LlmService, useValue: { enabled: false } },
        { provide: AmapMapService, useValue: { enabled: true } },
        { provide: TravelGuidePoiCollector, useValue: { collect } },
        { provide: TravelGuidePoiRanker, useValue: { rank: jest.fn() } },
        {
          provide: TravelGuideGenerationCacheService,
          useValue: { findPlan, savePlan },
        },
        {
          provide: UserProfileSyncService,
          useValue: { applyTravelGuideHints: jest.fn() },
        },
        {
          provide: WechatContentSecurityService,
          useValue: { assertTextsSafe: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideGenerationService);
  });

  it('returns cached plan without calling map collector', async () => {
    findPlan.mockResolvedValue(cachedPlan);

    const result = await service.generate(4, dto, testActor);

    expect(result.plan).toEqual(cachedPlan);
    expect(collect).not.toHaveBeenCalled();
    expect(savePlan).not.toHaveBeenCalled();
  });
});
