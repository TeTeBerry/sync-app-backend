/** CloudBase object keys under `avatar/` (upload to cloud storage root). */
export const RAVER_AVATAR_CLOUD_PREFIX = 'avatar/';

export const RAVER_AVATAR_ASSET_KEYS = [
  'avatar/cat-pink-headphones.png',
  'avatar/rabbit-green-headphones.png',
  'avatar/cat-cyan-headphones.png',
  'avatar/bunny-pink-green.png',
  'avatar/fox-rainbow-headphones.png',
  'avatar/cat-neon-headphones.png',
  'avatar/fox-peach-headphones.png',
  'avatar/bunny-teal-headphones.png',
  'avatar/cat-violet-headphones.png',
] as const;

export type RaverAvatarAssetKey = (typeof RAVER_AVATAR_ASSET_KEYS)[number];
