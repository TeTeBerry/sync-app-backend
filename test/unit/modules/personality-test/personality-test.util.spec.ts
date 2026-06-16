import { describe, expect, it } from '@jest/globals';
import { selectPersonalityQuestions } from '@src/modules/personality-test/utils/select-personality-questions.util';
import { scorePersonality } from '@src/modules/personality-test/utils/score-personality.util';
import { recommendDjLineup } from '@src/modules/personality-test/utils/recommend-dj-lineup.util';
import { buildPersonalityNarrative } from '@src/modules/personality-test/utils/build-narrative.util';
import { recommendEventsForPersonality } from '@src/modules/personality-test/utils/recommend-events.util';
import type {
  PersonalityLineupDj,
  PersonalityQuestion,
  PersonalityTestAnswers,
} from '@src/modules/personality-test/personality-test.types';
import type { IActivityLookupPort } from '@src/modules/activity/ports/activity-lookup.port';
import type { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';

function pickOptionId(question: PersonalityQuestion, index: number): string {
  return question.options[index]?.id ?? question.options[0]!.id;
}

function buildRagerAnswers(
  questions: PersonalityQuestion[],
): PersonalityTestAnswers {
  const picks = [0, 1, 0, 1, 2, 0, 0, 0];
  return Object.fromEntries(
    questions.map((question, index) => [
      question.id,
      pickOptionId(question, picks[index] ?? 0),
    ]),
  );
}

function buildConnoisseurAnswers(
  questions: PersonalityQuestion[],
): PersonalityTestAnswers {
  const picks = [1, 0, 2, 0, 1, 1, 1, 1];
  return Object.fromEntries(
    questions.map((question, index) => [
      question.id,
      pickOptionId(question, picks[index] ?? 0),
    ]),
  );
}

describe('personality-test scoring', () => {
  it('draws different question sets across sessions', () => {
    const first = selectPersonalityQuestions(() => 0).map(
      (question) => question.id,
    );
    const second = selectPersonalityQuestions(() => 0.99).map(
      (question) => question.id,
    );
    expect(first).toHaveLength(8);
    expect(second).toHaveLength(8);
    expect(first).not.toEqual(second);
  });

  it('shuffles question order across slots', () => {
    const slotOrder = selectPersonalityQuestions(() => 0.42).map(
      (question) => question.id.split('-')[0],
    );
    const canonicalOrder = [
      'audio',
      'track',
      'stage',
      'set',
      'buddy',
      'peak',
      'after',
      'memory',
    ];
    expect(slotOrder).not.toEqual(canonicalOrder);
  });

  it('scores rager-heavy answers', () => {
    const questions = selectPersonalityQuestions(() => 0);
    const score = scorePersonality(buildRagerAnswers(questions), questions);
    expect(score.primaryType).toBe('rager');
    expect(recommendDjLineup(score).soulMatch.djName).toBeTruthy();
  });

  it('prioritizes DJs on upcoming festival lineups', () => {
    const questions = selectPersonalityQuestions(() => 0);
    const score = scorePersonality(buildRagerAnswers(questions), questions);
    const offBill: PersonalityLineupDj = {
      id: 'dj-off',
      name: 'Off Bill Artist',
      genre: 'Big Room',
      genreLabel: 'Big Room',
      stage: 'main',
      popularity: 96,
      genreColor: '#ff2d55',
    };
    const onBill: PersonalityLineupDj = {
      id: 'dj-on',
      name: 'On Bill Artist',
      genre: 'Big Room',
      genreLabel: 'Big Room',
      stage: 'main',
      popularity: 82,
      genreColor: '#ff2d55',
    };
    const plain = recommendDjLineup(score, [offBill, onBill]);
    expect(plain.soulMatch.djName).toBe('Off Bill Artist');

    const boosted = recommendDjLineup(score, [offBill, onBill], {
      lineupDjNames: new Set(['on bill artist']),
    });
    expect(boosted.soulMatch.djName).toBe('On Bill Artist');
  });

  it('builds narrative without LLM', () => {
    const questions = selectPersonalityQuestions(() => 0);
    const answers = buildConnoisseurAnswers(questions);
    const score = scorePersonality(answers, questions);
    const recommendations = recommendDjLineup(score);
    const narrative = buildPersonalityNarrative(score, recommendations, [
      {
        activityLegacyId: 8,
        name: 'EDC Korea 2026',
        dateLabel: '2026.05',
        matchScore: 72,
        matchedDjs: [recommendations.soulMatch.djName],
        reason: '阵容含推荐 DJ',
      },
    ]);
    expect(narrative.tagline).toContain('副舞台探索者');
    expect(narrative.aiAnalysis.length).toBeGreaterThan(20);
    expect(narrative.aiAnalysis).toContain('阵容已官宣');
    expect(narrative.spiritConnections.length).toBeGreaterThan(0);
    expect(narrative.spiritConnections[0]?.role).toBe('soul');
    expect(narrative.spiritConnections[0]?.djName).toBe(
      recommendations.soulMatch.djName,
    );
    for (const entry of narrative.spiritConnections.slice(1)) {
      expect(entry.role).toBe('aligned');
    }
  });

  it('recommends events from DJ performances', async () => {
    const questions = selectPersonalityQuestions(() => 0);
    const score = scorePersonality(
      buildConnoisseurAnswers(questions),
      questions,
    );
    const recommendations = recommendDjLineup(score);
    const activityLookup = {
      findAll: async () => [
        {
          legacyId: 8,
          code: 'edc-korea',
          alias: 'edc-korea',
          name: 'EDC Korea 2026',
          date: '2026.05',
          location: 'Seoul',
          hot: true,
          attendees: 1200,
        },
      ],
      findByLegacyId: async () => null,
    } as unknown as IActivityLookupPort;
    const scheduleService = {
      findArtistPerformances: async ({ artistName }: { artistName: string }) =>
        artistName === recommendations.soulMatch.djName
          ? [
              {
                activityLegacyId: 8,
                activityName: 'EDC Korea 2026',
                artistName,
                dateLabel: '2026.05.16',
                stageLabel: 'Main',
                startTime: '22:00',
                endTime: '23:00',
                genreLabel: 'Techno',
              },
            ]
          : [],
    } as unknown as ItineraryScheduleService;

    const events = await recommendEventsForPersonality(
      recommendations,
      activityLookup,
      scheduleService,
    );
    expect(events[0]?.activityLegacyId).toBe(8);
    expect(events[0]?.matchedDjs).toContain(recommendations.soulMatch.djName);
  });

  it('does not recommend hot events without announced lineup', async () => {
    const questions = selectPersonalityQuestions(() => 0);
    const score = scorePersonality(
      buildConnoisseurAnswers(questions),
      questions,
    );
    const recommendations = recommendDjLineup(score);
    const activityLookup = {
      findAll: async () => [
        {
          legacyId: 99,
          code: 'tml-th',
          alias: 'tml-th',
          name: 'Tomorrowland Thailand 2026',
          date: '12/11-13',
          location: 'Pattaya',
          hot: true,
          attendees: 5000,
        },
      ],
      findByLegacyId: async () => null,
    } as unknown as IActivityLookupPort;
    const scheduleService = {
      findArtistPerformances: async () => [],
    } as unknown as ItineraryScheduleService;

    const events = await recommendEventsForPersonality(
      recommendations,
      activityLookup,
      scheduleService,
    );
    expect(events).toEqual([]);
  });

  it('does not recommend expired events', async () => {
    const questions = selectPersonalityQuestions(() => 0);
    const score = scorePersonality(
      buildConnoisseurAnswers(questions),
      questions,
    );
    const soulName = recommendationsSoulName(score);
    const activityLookup = {
      findAll: async () => [
        {
          legacyId: 1,
          code: 'past-fest',
          alias: 'past-fest',
          name: 'Past Festival 2024',
          date: '06/13-14',
          location: 'Shanghai',
        },
      ],
      findByLegacyId: async () => null,
    } as unknown as IActivityLookupPort;
    const scheduleService = {
      findArtistPerformances: async ({ artistName }: { artistName: string }) =>
        artistName === soulName
          ? [
              {
                activityLegacyId: 1,
                activityName: 'Past Festival 2024',
                artistName,
                dateLabel: '06/13',
                stageLabel: 'Main',
                startTime: '22:00',
                endTime: '23:00',
                genreLabel: 'Techno',
              },
            ]
          : [],
    } as unknown as ItineraryScheduleService;

    const events = await recommendEventsForPersonality(
      recommendDjLineup(score),
      activityLookup,
      scheduleService,
    );
    expect(events).toEqual([]);
  });

  it('sorts events by matched DJ weight from test result', async () => {
    const recommendations = {
      soulMatch: {
        djId: 'dj-soul',
        djName: 'Soul DJ',
        genreLabel: 'Techno',
        matchScore: 95,
        soulSimilarity: 92,
        tier: 'must_see' as const,
        dimensionBreakdown: { E: 1, M: 1, S: 1, C: 1 },
      },
      mustSee: [
        {
          djId: 'dj-must',
          djName: 'Must DJ',
          genreLabel: 'House',
          matchScore: 88,
          soulSimilarity: 80,
          tier: 'must_see' as const,
          dimensionBreakdown: { E: 1, M: 1, S: 1, C: 1 },
        },
      ],
      recommended: [],
      challenge: [],
    };
    const activityLookup = {
      findAll: async () => [
        {
          legacyId: 10,
          code: 'must-only',
          alias: 'must-only',
          name: 'Must Fest 2026',
          date: '08/10-11',
          location: 'Beijing',
        },
        {
          legacyId: 11,
          code: 'soul-fest',
          alias: 'soul-fest',
          name: 'Soul Fest 2026',
          date: '09/10-11',
          location: 'Shanghai',
        },
      ],
      findByLegacyId: async () => null,
    } as unknown as IActivityLookupPort;
    const scheduleService = {
      findArtistPerformances: async ({
        artistName,
      }: {
        artistName: string;
      }) => {
        if (artistName === 'Soul DJ') {
          return [
            {
              activityLegacyId: 11,
              activityName: 'Soul Fest 2026',
              artistName,
              dateLabel: '09/10',
              stageLabel: 'Main',
              startTime: '22:00',
              endTime: '23:00',
              genreLabel: 'Techno',
            },
          ];
        }
        if (artistName === 'Must DJ') {
          return [
            {
              activityLegacyId: 10,
              activityName: 'Must Fest 2026',
              artistName,
              dateLabel: '08/10',
              stageLabel: 'Main',
              startTime: '22:00',
              endTime: '23:00',
              genreLabel: 'House',
            },
          ];
        }
        return [];
      },
    } as unknown as ItineraryScheduleService;

    const events = await recommendEventsForPersonality(
      recommendations,
      activityLookup,
      scheduleService,
    );

    expect(events.map((event) => event.activityLegacyId)).toEqual([11, 10]);
    expect(events[0]?.matchedDjs[0]).toBe('Soul DJ');
  });
});

function recommendationsSoulName(
  score: ReturnType<typeof scorePersonality>,
): string {
  return recommendDjLineup(score).soulMatch.djName;
}
