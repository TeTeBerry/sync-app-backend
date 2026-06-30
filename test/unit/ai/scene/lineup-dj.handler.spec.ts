import { Test, TestingModule } from '@nestjs/testing';
import { LineupDjSceneHandler } from '../../../../src/ai/scene/handlers/lineup-dj.handler';
import { LlmService } from '../../../../src/infra/llm/llm.service';
import { LineupCatalogService } from '../../../../src/modules/itinerary/lineup-catalog.service';

describe('LineupDjSceneHandler', () => {
  let handler: LineupDjSceneHandler;
  let llmService: { invokeText: jest.Mock };

  beforeEach(async () => {
    llmService = { invokeText: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        LineupDjSceneHandler,
        { provide: LlmService, useValue: llmService },
        {
          provide: LineupCatalogService,
          useValue: { listLineupArtistsForActivities: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(LineupDjSceneHandler);
  });

  it('returns dj_bio effect', async () => {
    llmService.invokeText.mockResolvedValue(
      'Techno 先锋，以 hypnotic groove 闻名。',
    );

    const response = await handler.run(
      {
        scene: 'lineup_dj',
        activityLegacyId: 8,
        context: {
          artistName: 'Amelie Lens',
          activityLegacyId: 8,
          trigger: 'page_enter',
        },
      },
      { resolvedUserId: 'user-1' } as never,
    );

    expect(response.effects).toHaveLength(1);
    expect(response.effects[0].type).toBe('dj_bio');
  });
});
