import { formatDiscogsStyleLabel } from '../../dj/discogs-style-label.util';
import type { PersonalityTypeMeta } from '../data/personality-types';
import type { PersonalityTestRuntimeCatalog } from '../personality-test-catalog.types';
import type { DjCatalogItem } from '../../dj/dj.types';
import { DjService } from '../../dj/dj.service';
import {
  EDC_KOREA_PERSONALITY_LINEUP,
  lineupDjId,
} from '../data/personality-lineup';
import { PERSONALITY_TYPE_META } from '../data/personality-types';
import type {
  PersonalityLineupDj,
  PersonalityScoreResult,
  RecommendDjLineupResult,
} from '../personality-test.types';
import { recommendDjLineup } from './recommend-dj-lineup.util';

function catalogItemToLineupDj(item: DjCatalogItem): PersonalityLineupDj {
  const works = item.representativeWorks?.length ?? 0;
  return {
    id: lineupDjId(item.name),
    name: item.name,
    genre: item.genres[0] ?? 'Electronic',
    genreLabel: formatDiscogsStyleLabel(item),
    stage: 'main',
    popularity: Math.min(98, 68 + works * 4),
    genreColor: '#7b61ff',
  };
}

function uniqueLineup(pool: PersonalityLineupDj[]): PersonalityLineupDj[] {
  const seen = new Set<string>();
  const result: PersonalityLineupDj[] = [];
  for (const dj of pool) {
    const key = dj.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(dj);
  }
  return result;
}

export async function recommendDjLineupFromCatalog(
  score: PersonalityScoreResult,
  djService: DjService,
  runtimeCatalog?: Pick<
    PersonalityTestRuntimeCatalog,
    'typeMeta' | 'fallbackLineup' | 'soulProfiles'
  >,
): Promise<RecommendDjLineupResult> {
  const typeMeta = runtimeCatalog?.typeMeta ?? PERSONALITY_TYPE_META;
  const fallbackLineup =
    runtimeCatalog?.fallbackLineup ?? EDC_KOREA_PERSONALITY_LINEUP;
  const soulProfiles = runtimeCatalog?.soulProfiles;
  const primary = typeMeta[score.primaryType];
  const secondary = score.secondaryType ? typeMeta[score.secondaryType] : null;
  const styleTerms = [...primary.genreTags, ...(secondary?.genreTags ?? [])];

  const searchResult = await djService.searchByStyles(styleTerms, {
    limit: 40,
  });
  let pool = uniqueLineup(searchResult.items.map(catalogItemToLineupDj));

  if (pool.length < 10) {
    const catalog = await djService.loadCatalog();
    const extra = catalog
      .filter((item) =>
        styleTerms.some((term) => {
          const haystack =
            `${item.genres.join(' ')} ${item.styles.join(' ')}`.toLowerCase();
          return haystack.includes(term.toLowerCase());
        }),
      )
      .map(catalogItemToLineupDj);
    pool = uniqueLineup([...pool, ...extra]);
  }

  if (!pool.length) {
    pool = fallbackLineup;
  }

  return recommendDjLineup(score, pool.slice(0, 48), {
    typeMeta,
    soulProfiles,
  });
}
