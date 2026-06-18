/** CloudBase object keys under `avatar/` (upload to cloud storage root). */
export const RAVER_AVATAR_CLOUD_PREFIX = 'avatar/';

export const RAVER_AVATAR_ASSET_KEYS = [
  'avatar/01.webp',
  'avatar/02.webp',
  'avatar/03.webp',
  'avatar/04.webp',
  'avatar/05.webp',
  'avatar/06.webp',
  'avatar/07.webp',
  'avatar/08.webp',
  'avatar/09.webp',
  'avatar/10.webp',
  'avatar/11.webp',
  'avatar/12.webp',
] as const;

export type RaverAvatarAssetKey = (typeof RAVER_AVATAR_ASSET_KEYS)[number];
