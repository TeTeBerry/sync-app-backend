import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TravelGuidePoiPipeline } from '@src/modules/travel-guide/map/travel-guide-poi.pipeline';
import { TravelGuidePoiCollector } from '@src/modules/travel-guide/map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from '@src/modules/travel-guide/map/travel-guide-poi.ranker';

describe('TravelGuidePoiPipeline', () => {
  const activity = {
    legacyId: 4,
    name: 'Storm',
    date: '06/13-14',
    location: '深圳',
  } as never;
  const generationDto = {
    departure: '上海',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: false,
    accommodationNights: 2,
  };

  it('throws when collector returns null', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuidePoiPipeline,
        {
          provide: TravelGuidePoiCollector,
          useValue: { collect: jest.fn().mockResolvedValue(null) },
        },
        { provide: TravelGuidePoiRanker, useValue: { rank: jest.fn() } },
      ],
    }).compile();

    const pipeline = moduleRef.get(TravelGuidePoiPipeline);
    await expect(pipeline.run(activity, generationDto, 2)).rejects.toThrow(
      '无法获取场馆周边推荐',
    );
  });

  it('throws when ranked hotels are empty for multi-night stay', async () => {
    const mapCtx = { venue: { title: '会场' } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuidePoiPipeline,
        {
          provide: TravelGuidePoiCollector,
          useValue: { collect: jest.fn().mockResolvedValue(mapCtx) },
        },
        {
          provide: TravelGuidePoiRanker,
          useValue: {
            rank: jest.fn().mockReturnValue({
              hotels: [],
              nightlife: [{ name: '夜宵' }],
              parking: [],
            }),
          },
        },
      ],
    }).compile();

    const pipeline = moduleRef.get(TravelGuidePoiPipeline);
    await expect(
      pipeline.run(activity, generationDto, 2),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
