import type { DjCatalogItem, DjRepresentativeWork } from '../../dj/dj.types';
import { truncateCatalogProfileSummary } from './lineup-artist-id.util';

/** Newest releases first; missing year sorts after dated releases. */
export function sortRepresentativeWorksByRecency(
  works: DjRepresentativeWork[],
): DjRepresentativeWork[] {
  return [...works].sort((a, b) => {
    const yearA = a.year ?? 0;
    const yearB = b.year ?? 0;
    if (yearB !== yearA) {
      return yearB - yearA;
    }
    return b.releaseId - a.releaseId;
  });
}

export function pickRepresentativeTrackTitles(
  works: DjRepresentativeWork[] | undefined,
  limit = 3,
): string[] {
  const titles: string[] = [];

  for (const work of sortRepresentativeWorksByRecency(works ?? [])) {
    const trackItems = work.tracks ?? [];
    if (trackItems.length) {
      for (const track of trackItems) {
        const trimmed = track.trim();
        if (!trimmed || titles.includes(trimmed)) {
          continue;
        }
        titles.push(trimmed);
        if (titles.length >= limit) {
          return titles;
        }
      }
      continue;
    }

    const releaseTitle = work.title?.trim();
    if (releaseTitle && !titles.includes(releaseTitle)) {
      titles.push(releaseTitle);
      if (titles.length >= limit) {
        return titles;
      }
    }
  }

  return titles;
}

export function buildArtistProfileDetailFromCatalog(catalog?: DjCatalogItem): {
  profileSummary?: string;
  profileFull?: string;
  representativeTracks: string[];
} {
  const profileFull = catalog?.profile?.trim();
  const profileSummary = truncateCatalogProfileSummary(profileFull);
  const representativeTracks = pickRepresentativeTrackTitles(
    catalog?.representativeWorks,
    3,
  );

  return {
    ...(profileSummary ? { profileSummary } : {}),
    ...(profileFull ? { profileFull } : {}),
    representativeTracks,
  };
}
