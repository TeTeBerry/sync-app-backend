/** sync-web design tokens (app/globals.css) for poster rendering */
export const SYNC_WEB_PALETTE = {
  background: '#08080c',
  foreground: '#ededf0',
  card: '#12121a',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  primary: '#8b7cf8',
  secondary: '#6e66e8',
  inkStrong: 'rgba(237, 237, 240, 0.92)',
  inkBody: 'rgba(237, 237, 240, 0.78)',
  inkMuted: 'rgba(237, 237, 240, 0.58)',
  inkDim: 'rgba(237, 237, 240, 0.48)',
  inkFaint: 'rgba(237, 237, 240, 0.38)',
  primarySoft: 'rgba(139, 124, 248, 0.14)',
  borderSoft: 'rgba(255, 255, 255, 0.08)',
  quoteBorder: 'rgba(139, 124, 248, 0.45)',
  codeBg: 'rgba(255, 255, 255, 0.06)',
  cyan: '#67c8e8',
} as const;

/** md2poster-style outer gradient using sync-web purple accents */
export const SYNC_WEB_POSTER_BACKGROUND =
  'linear-gradient(165deg, #1a1530 0%, #6e66e8 38%, #8b7cf8 62%, #3d2f6b 100%)';

export const SYNC_WEB_CARD_SHADOW =
  '0 20px 48px rgba(7, 6, 15, 0.55), 0 0 32px rgba(139, 124, 248, 0.14)';

export const SYNC_WEB_IMAGE_SHADOW =
  '0 8px 24px rgba(7, 6, 15, 0.45), 0 0 16px rgba(110, 102, 232, 0.12)';
