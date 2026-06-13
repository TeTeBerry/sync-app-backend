import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelPlanReceiptRecognizeJob } from '@src/database/schemas/travel-plan-receipt-recognize-job.schema';
import { TravelPlanReceiptRecognizeJobService } from '@src/modules/travel-plan/travel-plan-receipt-recognize-job.service';
import { TravelPlanReceiptRecognizeService } from '@src/modules/travel-plan/travel-plan-receipt-recognize.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

const actor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-1',
  displayName: 'Test',
  resolvedUserId: 'user-1',
};

const cloudImage =
  'cloud://sync-prd-d7gquj4qk86da9bb2.xxx/ugc/posts/user-1/receipt.jpg';

describe('TravelPlanReceiptRecognizeJobService', () => {
  let service: TravelPlanReceiptRecognizeJobService;
  const model = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const recognizeService = {
    recognize: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelPlanReceiptRecognizeJobService,
        {
          provide: getModelToken(TravelPlanReceiptRecognizeJob.name),
          useValue: model,
        },
        {
          provide: TravelPlanReceiptRecognizeService,
          useValue: recognizeService,
        },
      ],
    }).compile();

    service = moduleRef.get(TravelPlanReceiptRecognizeJobService);
  });

  it('creates a pending job for cloud fileID', async () => {
    model.create.mockResolvedValue({});

    const result = await service.createJob(
      4,
      { category: 'transport', image: cloudImage },
      actor,
    );

    expect(result.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: result.jobId,
        activityLegacyId: 4,
        ownerUserId: 'user-1',
        status: 'pending',
      }),
    );
  });

  it('rejects non-cloud image refs', async () => {
    await expect(
      service.createJob(
        4,
        { category: 'transport', image: 'data:image/jpeg;base64,abc' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns completed job view for owner', async () => {
    model.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          jobId: 'job-1',
          ownerUserId: 'user-1',
          status: 'completed',
          result: { ok: true, filled: true, category: 'transport' },
        }),
    });

    const view = await service.getJob('job-1', actor);
    expect(view.status).toBe('completed');
    expect(view.result?.filled).toBe(true);
  });

  it('forbids non-owner from reading job', async () => {
    model.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          jobId: 'job-1',
          ownerUserId: 'other-user',
          status: 'pending',
        }),
    });

    await expect(service.getJob('job-1', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws when job missing', async () => {
    model.findOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await expect(service.getJob('missing', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
