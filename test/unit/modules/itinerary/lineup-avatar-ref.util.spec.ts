import {
  buildLineupAvatarCloudFileId,
  isLineupAvatarAssetKey,
  isLineupAvatarCloudFileId,
} from '@src/modules/itinerary/utils/lineup-avatar-ref.util';

describe('lineup-avatar-ref.util', () => {
  const envId = 'sync-prd-test';
  const bucket = '7379-sync-prd-test-123';

  it('accepts lineup-avatar asset keys', () => {
    expect(isLineupAvatarAssetKey('lineup-avatar/kanine.jpg')).toBe(true);
    expect(isLineupAvatarAssetKey('avatar/kanine.jpg')).toBe(false);
    expect(isLineupAvatarAssetKey('lineup-avatar/../evil.jpg')).toBe(false);
  });

  it('builds cloud file ids with optional bucket', () => {
    expect(
      buildLineupAvatarCloudFileId(envId, 'lineup-avatar/kanine.jpg'),
    ).toBe('cloud://sync-prd-test/lineup-avatar/kanine.jpg');
    expect(
      buildLineupAvatarCloudFileId(envId, 'lineup-avatar/kanine.jpg', bucket),
    ).toBe(`cloud://${envId}.${bucket}/lineup-avatar/kanine.jpg`);
  });

  it('recognizes lineup cloud file ids', () => {
    const fileId = buildLineupAvatarCloudFileId(
      envId,
      'lineup-avatar/martin-garrix.jpg',
      bucket,
    );
    expect(isLineupAvatarCloudFileId(fileId)).toBe(true);
    expect(isLineupAvatarCloudFileId('cloud://other-env/avatar/x.jpg')).toBe(
      false,
    );
  });
});
