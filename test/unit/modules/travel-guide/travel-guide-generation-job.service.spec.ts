import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelGuideGenerationJob } from '@src/database/schemas/travel-guide-generation-job.schema';
import { TravelGuideGenerationJobService } from '@src/modules/travel-guide/travel-guide-generation-job.service';
import { TravelGuideGenerationService } from '@src/modules/travel-guide/travel-guide-generation.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

const actor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-1',
  displayName: 'Test',
  resolvedUserId: 'user-1',
};

describe('TravelGuideGenerationJobService', () => {
  let service: TravelGuideGenerationJobService;
  const model = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const generationService = {
    generate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideGenerationJobService,
        {
          provide: getModelToken(TravelGuideGenerationJob.name),
          useValue: model,
        },
        { provide: TravelGuideGenerationService, useValue: generationService },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideGenerationJobService);
  });

  it('creates a pending job and returns jobId', async () => {
    model.create.mockResolvedValue({});

    const result = await service.createJob(
      4,
      {
        departure: '上海虹桥',
        headcount: 2,
        budgetTier: 'standard',
      },
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

  it('returns completed job view for owner', async () => {
    model.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          jobId: 'job-1',
          ownerUserId: 'user-1',
          status: 'completed',
          plan: { activityName: 'Test' },
        }),
    });

    const view = await service.getJob('job-1', actor);

    expect(view.status).toBe('completed');
    expect(view.plan).toEqual({ activityName: 'Test' });
  });

  it('rejects foreign job access', async () => {
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
