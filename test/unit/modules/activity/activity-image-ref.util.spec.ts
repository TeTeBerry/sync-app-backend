import {
  activityImageCloudPath,
  assertActivityStaticCloudFileIdForEnv,
  buildActivityCloudFileId,
  isActivityStaticAssetKey,
  isActivityStaticCloudFileId,
} from '@src/modules/activity/utils/activity-image-ref.util';

describe('activity-image-ref.util', () => {
  const envId = 'sync-prd-test';
  const bucket = '7379-sync-prd-test-bucket';

  it('builds cloud paths from activity code', () => {
    expect(activityImageCloudPath('edc-korea', 'png')).toBe(
      'static/activity/edc-korea.png',
    );
  });

  it('accepts static activity asset keys', () => {
    expect(isActivityStaticAssetKey('static/activity/tomorrowland.jpg')).toBe(
      true,
    );
    expect(isActivityStaticAssetKey('static/activity/../evil.jpg')).toBe(false);
  });

  it('builds cloud file ids', () => {
    expect(
      buildActivityCloudFileId(envId, 'static/activity/edc-korea.png'),
    ).toBe('cloud://sync-prd-test/static/activity/edc-korea.png');
    expect(
      buildActivityCloudFileId(envId, 'static/activity/edc-korea.png', bucket),
    ).toBe(`cloud://${envId}.${bucket}/static/activity/edc-korea.png`);
  });

  it('validates cloud file ids for env', () => {
    const fileId = buildActivityCloudFileId(
      envId,
      'static/activity/tomorrowland.jpg',
      bucket,
    );
    expect(isActivityStaticCloudFileId(fileId)).toBe(true);
    process.env.CLOUDBASE_ENV_ID = envId;
    expect(() => assertActivityStaticCloudFileIdForEnv(fileId)).not.toThrow();
    delete process.env.CLOUDBASE_ENV_ID;
  });
});
