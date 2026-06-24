import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PersonalityTestService } from '@src/modules/personality-test/personality-test.service';
import { PersonalityTestCatalogService } from '@src/modules/personality-test/personality-test-catalog.service';
import { ACTIVITY_LOOKUP_PORT } from '@src/modules/activity/ports/activity-lookup.port';
import { DjService } from '@src/modules/dj/dj.service';
import { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';
import { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import { CloudStorageService } from '@src/infra/cloud/cloud-storage.service';
import { UserPersonalityTestResult } from '@src/database/schemas/user-personality-test-result.schema';
import { PERSONALITY_TYPE_META } from '@src/modules/personality-test/data/personality-types';
import { selectPersonalityQuestions } from '@src/modules/personality-test/utils/select-personality-questions.util';
import { scorePersonality } from '@src/modules/personality-test/utils/score-personality.util';
import type { PersonalityTestAnswers } from '@src/modules/personality-test/personality-test.types';
import type { RequestActor } from '@src/common/auth/request-actor.types';

function pickOptionId(
  question: ReturnType<typeof selectPersonalityQuestions>[number],
  index: number,
): string {
  return question.options[index]?.id ?? question.options[0]!.id;
}

function buildRagerAnswers(
  questions: ReturnType<typeof selectPersonalityQuestions>,
): PersonalityTestAnswers {
  const picks = [0, 1, 0, 1, 2, 0, 0, 0];
  return Object.fromEntries(
    questions.map((question, index) => [
      question.id,
      pickOptionId(question, picks[index] ?? 0),
    ]),
  );
}

const loggedInActor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-1',
  resolvedUserId: 'user-1',
  displayName: 'Test',
};

const anonymousActor: RequestActor = {
  source: 'anonymous',
  clientUserId: '',
  resolvedUserId: '',
  displayName: '',
};

describe('PersonalityTestService profile sync', () => {
  let service: PersonalityTestService;
  let applyPersonalityTestHints: jest.Mock;
  let findOneAndUpdate: jest.Mock;

  beforeEach(async () => {
    applyPersonalityTestHints = jest.fn();
    findOneAndUpdate = jest.fn().mockResolvedValue(undefined);

    const questions = selectPersonalityQuestions(() => 0);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PersonalityTestService,
        {
          provide: ACTIVITY_LOOKUP_PORT,
          useValue: {
            findAllBasics: jest.fn().mockResolvedValue([{ legacyId: 8 }]),
          },
        },
        {
          provide: DjService,
          useValue: {
            lookupForLineupArtists: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: ItineraryScheduleService,
          useValue: {
            listLineupArtistsForActivities: jest
              .fn()
              .mockResolvedValue([
                { artistName: 'On Bill Artist', genreLabel: 'Big Room' },
              ]),
            findArtistPerformances: jest.fn().mockResolvedValue([]),
            findArtistLineupMemberships: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PersonalityTestCatalogService,
          useValue: {
            resolveByIds: jest.fn().mockResolvedValue(questions),
            getRuntimeCatalog: jest.fn().mockResolvedValue({
              typeMeta: PERSONALITY_TYPE_META,
              fallbackLineup: [],
              soulProfiles: undefined,
            }),
          },
        },
        {
          provide: CloudStorageService,
          useValue: { fetchCloudFileDownloadUrls: jest.fn() },
        },
        {
          provide: UserProfileSyncService,
          useValue: { applyPersonalityTestHints },
        },
        {
          provide: getModelToken(UserPersonalityTestResult.name),
          useValue: { findOneAndUpdate },
        },
      ],
    }).compile();

    service = moduleRef.get(PersonalityTestService);
  });

  it('syncs favorGenres after submit when user is logged in', async () => {
    const questions = selectPersonalityQuestions(() => 0);
    const answers = buildRagerAnswers(questions);
    const score = scorePersonality(answers, questions);

    await service.submit(
      {
        questionIds: questions.map((question) => question.id),
        answers,
      },
      loggedInActor,
    );

    expect(applyPersonalityTestHints).toHaveBeenCalledWith(loggedInActor, {
      primaryType: score.primaryType,
      typeMeta: PERSONALITY_TYPE_META,
    });
  });

  it('does not sync favorGenres after submit for anonymous users', async () => {
    const questions = selectPersonalityQuestions(() => 0);
    const answers = buildRagerAnswers(questions);

    await service.submit(
      {
        questionIds: questions.map((question) => question.id),
        answers,
      },
      anonymousActor,
    );

    expect(applyPersonalityTestHints).not.toHaveBeenCalled();
  });
});
