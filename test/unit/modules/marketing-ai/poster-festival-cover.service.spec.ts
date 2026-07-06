import { PosterFestivalCoverService } from '../../../../src/modules/marketing-ai/image-renderer/poster-festival-cover.service';
import type { ActivityImageService } from '../../../../src/modules/activity/activity-image.service';
import type { ActivityLookupService } from '../../../../src/modules/activity/activity-lookup.service';

describe('PosterFestivalCoverService', () => {
  const activityLookup = {
    findByCode: jest.fn(),
  } as unknown as jest.Mocked<Pick<ActivityLookupService, 'findByCode'>>;

  const activityImages = {
    resolveImageRefs: jest.fn(),
  } as unknown as jest.Mocked<Pick<ActivityImageService, 'resolveImageRefs'>>;

  const service = new PosterFestivalCoverService(
    activityLookup as unknown as ActivityLookupService,
    activityImages as unknown as ActivityImageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves explicit festival.image cloud keys', async () => {
    activityImages.resolveImageRefs.mockResolvedValue(
      new Map([['static/activity/tomorrowland.jpg', 'https://cdn/cover.jpg']]),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    }) as unknown as typeof fetch;

    const dataUrl = await service.resolveCoverDataUrl({
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand 2026',
      image: 'static/activity/tomorrowland.jpg',
    });

    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(activityLookup.findByCode).not.toHaveBeenCalled();
  });

  it('falls back to activity catalog lookup by festival id code', async () => {
    activityLookup.findByCode.mockResolvedValue({
      legacyId: 1,
      name: 'Tomorrowland Thailand 2026',
      code: 'tomorrowland',
      image: 'https://cdn/tomorrowland.jpg',
    } as never);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => Uint8Array.from([9, 9, 9]).buffer,
    }) as unknown as typeof fetch;

    const dataUrl = await service.resolveCoverDataUrl({
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand 2026',
    });

    expect(activityLookup.findByCode).toHaveBeenCalledWith('tomorrowland');
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});
