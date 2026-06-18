import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { TravelGuideSavedPlan } from '@src/database/schemas/travel-guide-saved-plan.schema';
import type { TravelGuidePlan } from '@src/modules/travel-guide/domain/travel-guide.types';

const plan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '交通', lines: [] },
  accommodation: { title: '住宿', hotels: [] },
  nightlife: { title: '散场', spots: [] },
  tips: { title: '提示', items: [] },
};

describe('TravelGuideSavedPlanService', () => {
  let service: TravelGuideSavedPlanService;
  let updateOne: jest.Mock;
  let findOne: jest.Mock;

  beforeEach(async () => {
    updateOne = jest.fn().mockReturnValue({ exec: jest.fn() });
    findOne = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideSavedPlanService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'travelGuide.savedPlanTtlSec' ? 3600 : undefined,
          },
        },
        {
          provide: getModelToken(TravelGuideSavedPlan.name),
          useValue: { updateOne, findOne },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideSavedPlanService);
  });

  it('upserts saved plan with resolved form fields', async () => {
    await service.upsert(
      'guide-12345678',
      'wx_user',
      4,
      {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: true,
      },
      2,
      plan,
    );

    expect(updateOne).toHaveBeenCalledWith(
      { guideId: 'guide-12345678' },
      expect.objectContaining({
        $set: expect.objectContaining({
          guideId: 'guide-12345678',
          ownerUserId: 'wx_user',
          activityLegacyId: 4,
          form: {
            departure: '上海',
            headcount: 2,
            budgetTier: 'standard',
            selfDrive: true,
            accommodationNights: 2,
          },
          plan,
        }),
      }),
      { upsert: true },
    );
  });

  it('returns null when guide id is blank', async () => {
    await expect(service.findByGuideId('   ')).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('maps stored document to read view', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          guideId: 'guide-12345678',
          activityLegacyId: 4,
          form: {
            departure: '上海',
            headcount: 2,
            budgetTier: 'standard',
            accommodationNights: 2,
          },
          plan,
          createdAt,
        }),
      }),
    });

    await expect(service.findByGuideId('guide-12345678')).resolves.toEqual({
      guideId: 'guide-12345678',
      activityLegacyId: 4,
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      plan,
      createdAt: createdAt.toISOString(),
    });
  });
});
