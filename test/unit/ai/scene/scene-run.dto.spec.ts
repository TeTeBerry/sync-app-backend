import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SceneRunDto } from '../../../../src/ai/scene/dto/scene-run.dto';

async function validateSceneRun(body: Record<string, unknown>) {
  const dto = plainToInstance(SceneRunDto, body);
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('SceneRunDto', () => {
  it('accepts festival_story with activityLegacyId in context', async () => {
    const errors = await validateSceneRun({
      scene: 'festival_story',
      context: {
        activityLegacyId: 8,
        trigger: 'page_enter',
      },
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts lineup_dj scene', async () => {
    await expect(
      validateSceneRun({
        scene: 'lineup_dj',
        activityLegacyId: 8,
        context: {
          activityLegacyId: 8,
          artistName: 'Charlotte de Witte',
          trigger: 'page_enter',
        },
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects unknown scene ids', async () => {
    const errors = await validateSceneRun({
      scene: 'unknown_scene',
      context: { activityLegacyId: 8 },
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
