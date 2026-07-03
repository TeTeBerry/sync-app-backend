import {
  buildLineupAvatarCloudFileId,
  isDiscogsAvatarUrl,
  isLineupAvatarAssetKey,
  isLineupAvatarCloudFileId,
  isRemoteLineupAvatarUrl,
  isStoredLineupAvatarRef,
  isUsableLineupAvatarUrl,
} from '@src/modules/itinerary/utils/lineup-avatar-ref.util';

describe('lineup-avatar-ref.util', () => {
  const envId = 'sync-prd-test';
  const bucket = '7379-sync-prd-test-123';

  it('accepts lineup-avatar asset keys', () => {
    expect(isLineupAvatarAssetKey('lineup-avatar/kanine.jpg')).toBe(true);
    expect(isLineupAvatarAssetKey('avatar/kanine.jpg')).toBe(false);
    expect(isLineupAvatarAssetKey('lineup-avatar/../evil.jpg')).toBe(false);
  });

  it('accepts public CDN avatar URLs', () => {
    expect(isRemoteLineupAvatarUrl('https://i.discogs.com/example.jpg')).toBe(
      true,
    );
    expect(isRemoteLineupAvatarUrl('lineup-avatar/kanine.jpg')).toBe(false);
  });

  it('rejects Discogs avatar URLs for catalog display', () => {
    expect(isDiscogsAvatarUrl('https://i.discogs.com/example.jpg')).toBe(true);
    expect(isDiscogsAvatarUrl('https://img.discogs.com/foo.jpg')).toBe(true);
    expect(
      isUsableLineupAvatarUrl('https://i.discogs.com/example.jpg', 'discogs'),
    ).toBe(false);
    expect(
      isUsableLineupAvatarUrl(
        'https://www.theaudiodb.com/images/media/artist/thumb/xyz.jpg',
        'theaudiodb',
      ),
    ).toBe(true);
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

  it('accepts stored CloudBase avatar refs but still rejects Discogs', () => {
    const fileId = buildLineupAvatarCloudFileId(
      envId,
      'lineup-avatar/martin-garrix.jpg',
      bucket,
    );

    expect(isStoredLineupAvatarRef('lineup-avatar/martin-garrix.jpg')).toBe(
      true,
    );
    expect(isStoredLineupAvatarRef(fileId)).toBe(true);
    expect(
      isStoredLineupAvatarRef('https://i.discogs.com/example.jpg', 'discogs'),
    ).toBe(false);
  });
});
