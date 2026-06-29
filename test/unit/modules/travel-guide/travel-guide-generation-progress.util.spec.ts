import {
  TRAVEL_GUIDE_PROGRESS,
  reportTravelGuideProgress,
} from '@src/modules/travel-guide/domain/travel-guide-generation-progress.util';

describe('travel-guide-generation-progress.util', () => {
  it('reportTravelGuideProgress invokes reporter with canonical percent', async () => {
    const reporter = jest.fn();
    await reportTravelGuideProgress(reporter, 'map_poi');
    expect(reporter).toHaveBeenCalledWith(TRAVEL_GUIDE_PROGRESS.map_poi);
  });

  it('reportTravelGuideProgress no-ops without reporter', async () => {
    await expect(
      reportTravelGuideProgress(undefined, 'validating'),
    ).resolves.toBeUndefined();
  });
});
