import type { RawMapPoi } from './travel-guide-map.types';

/** 散场仅检索腾讯地图「夜宵」类目，不含酒吧/夜店/便利店等。 */
export const AFTERPARTY_SEARCH_KEYWORD = '夜宵';

export function isAfterpartyMapPoi(
  p: Pick<RawMapPoi, 'kind' | 'keyword'>,
): boolean {
  return p.kind === 'nightlife_food' && p.keyword === AFTERPARTY_SEARCH_KEYWORD;
}
