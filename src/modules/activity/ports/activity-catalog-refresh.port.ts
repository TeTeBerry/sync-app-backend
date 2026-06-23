export interface IActivityCatalogRefreshPort {
  refreshAfterLineupCatalogChange(): Promise<void>;
}

export const ACTIVITY_CATALOG_REFRESH_PORT = Symbol(
  'ACTIVITY_CATALOG_REFRESH_PORT',
);
