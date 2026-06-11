import { LiveInfoService } from '@src/modules/live-info/live-info.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

describe('LiveInfoService', () => {
  const actor = {
    resolvedUserId: 'viewer-1',
    clientUserId: 'viewer-1',
  } as RequestActor;

  it('getSnapshot returns viewer and feed arrays', async () => {
    const wristbandModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    };
    const updateModel = {
      find: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const activityService = {
      findByLegacyId: jest.fn().mockResolvedValue({
        legacyId: 4,
        name: '风暴',
        date: '2026-03-15',
        location: '曼谷',
      }),
    };
    const onSiteIdentity = {
      getOnSiteCertifiedUserIds: jest.fn().mockResolvedValue(new Set()),
    };

    const service = new LiveInfoService(
      wristbandModel as never,
      updateModel as never,
      activityService as never,
      {} as never,
      {} as never,
      onSiteIdentity as never,
      {} as never,
      {} as never,
    );

    const snapshot = await service.getSnapshot(4, actor, {});
    expect(snapshot.activityLegacyId).toBe(4);
    expect(snapshot.viewer).toBeDefined();
    expect(Array.isArray(snapshot.feed)).toBe(true);
    expect(Array.isArray(snapshot.zones)).toBe(true);
  });
});
