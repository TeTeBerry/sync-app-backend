/** Layout tokens for travel guide poster — baseline at Instagram 1080px width. */
export const TRAVEL_GUIDE_LAYOUT = {
  title: 56,
  titleFlag: 46,
  sectionTitle: 28,
  meta: 24,
  metaIcon: 24,
  guideLabel: 26,
  guideSubtitle: 22,
  guideIcon: 30,
  follow: 17,
  tagline: 20,
  taglineIcon: 20,
  dividerMargin: 18,
  guideSectionGap: 12,
  cardRadius: 28,
  dividerWidth: '90%',
} as const;

export function scaleLayout(value: number, layoutScale: number): number {
  return Math.round(value * layoutScale);
}
