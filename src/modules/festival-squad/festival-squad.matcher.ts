import { Injectable } from '@nestjs/common';

type Profile = {
  eventId: number;
  arrivalDate: string;
  accommodationType: string;
  budgetLevel: string;
  originCity: string;
  originCountry?: string;
  favoriteArtistIds?: string[];
  favoriteArtists?: string[];
  favoriteGenres?: string[];
  lookingFor?: string[];
};

export type FestivalSquadMatchResult = {
  score: number;
  label: 'excellent' | 'strong' | 'good' | 'some_shared' | 'sparse';
  /** Stable reason codes for client i18n (not display copy). */
  reasons: string[];
  sharedArtists: string[];
  sharedGenres: string[];
  sharedPreferenceCount: number;
  sparseData: boolean;
};

@Injectable()
export class FestivalSquadMatcher {
  match(viewer: Profile, candidate: Profile): FestivalSquadMatchResult {
    let score = 0;
    const reasons: string[] = [];
    let sharedPreferenceCount = 0;
    const add = (points: number, reason: string, preference = false) => {
      score += points;
      reasons.push(reason);
      if (preference) sharedPreferenceCount += 1;
    };
    if (viewer.eventId === candidate.eventId) add(20, 'sameFestival');
    if (viewer.arrivalDate === candidate.arrivalDate) add(18, 'sameArrivalDay');
    if (
      viewer.accommodationType !== 'not_decided' &&
      viewer.accommodationType === candidate.accommodationType
    )
      add(15, 'sameAccommodationType');
    if (viewer.budgetLevel === candidate.budgetLevel) add(10, 'similarBudget');
    if (this.same(viewer.originCity, candidate.originCity))
      add(10, 'sameOriginCity');
    else if (
      viewer.originCountry &&
      candidate.originCountry &&
      this.same(viewer.originCountry, candidate.originCountry)
    )
      add(5, 'sameOriginCountry');
    const sharedArtistIds = this.intersection(
      viewer.favoriteArtistIds,
      candidate.favoriteArtistIds,
    );
    const sharedArtistNames = this.intersection(
      viewer.favoriteArtists,
      candidate.favoriteArtists,
    );
    const sharedArtists =
      sharedArtistNames.length > 0 ? sharedArtistNames : sharedArtistIds;
    if (sharedArtists.length)
      add(
        Math.min(15, 5 + sharedArtists.length * 3),
        sharedArtists.length === 1 ? 'sharedArtistsOne' : 'sharedArtistsMany',
        true,
      );
    const sharedGenres = this.intersection(
      viewer.favoriteGenres,
      candidate.favoriteGenres,
    );
    if (sharedGenres.length)
      add(
        Math.min(8, sharedGenres.length * 4),
        sharedGenres.length === 1 ? 'sharedGenresOne' : 'sharedGenresMany',
        true,
      );
    if (this.intersection(viewer.lookingFor, candidate.lookingFor).length)
      add(4, 'sameLookingFor', true);
    const sparseData =
      !viewer.favoriteArtistIds?.length || !candidate.favoriteArtistIds?.length;
    const label =
      score >= 70
        ? 'excellent'
        : score >= 50
          ? 'strong'
          : score >= 30
            ? 'good'
            : score >= 15
              ? 'some_shared'
              : 'sparse';
    return {
      score: Math.min(100, score),
      label,
      reasons,
      sharedArtists,
      sharedGenres,
      sharedPreferenceCount,
      sparseData,
    };
  }
  private same(a?: string, b?: string) {
    return Boolean(
      a && b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase(),
    );
  }
  private intersection(a: string[] = [], b: string[] = []) {
    const right = new Set(b.map((v) => v.toLocaleLowerCase()));
    return [...new Set(a.filter((v) => right.has(v.toLocaleLowerCase())))];
  }
}
