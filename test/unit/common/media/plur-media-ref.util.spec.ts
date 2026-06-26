import {
  assertPlurStaticCloudFileIdForEnv,
  isPlurStaticAssetKey,
  isPlurStaticCloudFileId,
  PLUR_STATIC_MEDIA_PREFIX,
} from '@src/common/media/plur-media-ref.util';

describe('plur-media-ref.util', () => {
  it('accepts static/plur object keys', () => {
    expect(
      isPlurStaticAssetKey(`${PLUR_STATIC_MEDIA_PREFIX}peace-entry-cover.jpg`),
    ).toBe(true);
    expect(
      isPlurStaticAssetKey(`${PLUR_STATIC_MEDIA_PREFIX}scenes/peace.jpg`),
    ).toBe(true);
    expect(isPlurStaticAssetKey('static/activity/tomorrowland.jpg')).toBe(
      false,
    );
    expect(isPlurStaticAssetKey('static/plur/../evil.jpg')).toBe(false);
  });

  it('validates cloud file ids for the configured env', () => {
    const envId = 'sync-prd-test';
    const fileId = `cloud://${envId}/static/plur/scenes/peace.jpg`;
    expect(isPlurStaticCloudFileId(fileId)).toBe(true);
    process.env.CLOUDBASE_ENV_ID = envId;
    expect(() => assertPlurStaticCloudFileIdForEnv(fileId)).not.toThrow();
    expect(() =>
      assertPlurStaticCloudFileIdForEnv(
        'cloud://other-env/static/plur/peace.jpg',
      ),
    ).toThrow('PLUR 媒体资源无效');
    delete process.env.CLOUDBASE_ENV_ID;
  });
});
