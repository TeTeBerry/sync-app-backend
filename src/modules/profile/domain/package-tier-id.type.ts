/** Per-event (单场) profile package tier identifiers. */
export type PackageTierId = 'pro' | 'pro_plus' | 'ultra';

export const PACKAGE_TIER_IDS: PackageTierId[] = ['pro', 'pro_plus', 'ultra'];

export function isPackageTierId(value: string): value is PackageTierId {
  return (PACKAGE_TIER_IDS as string[]).includes(value);
}
