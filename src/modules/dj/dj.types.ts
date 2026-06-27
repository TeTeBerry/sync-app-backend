export type DjRepresentativeWork = {
  releaseId: number;
  title: string;
  year?: number;
  type?: string;
  tracks: string[];
};

export type DjCatalogItem = {
  discogsId: number;
  name: string;
  realName?: string;
  profile?: string;
  genres: string[];
  styles: string[];
  country?: string;
  urls?: string[];
  representativeWorks?: DjRepresentativeWork[];
  chineseAliases?: string[];
};

export type DjSearchResult = {
  items: DjCatalogItem[];
  total: number;
  limit: number;
  skip: number;
};
