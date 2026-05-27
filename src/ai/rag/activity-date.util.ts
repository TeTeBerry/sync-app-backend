import { extractYearFromText } from '../../common/utils/activity-date.util';
export { extractYearFromText };

/** 从活动 catalog 日期串（如 06/13-14）推导 ISO 起始日 */
export function catalogDateToIso(
  catalogDate: string,
  yearHint?: string,
): string | undefined {
  const trimmed = catalogDate.trim();
  if (!trimmed) return undefined;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;

  const year = yearHint ?? String(new Date().getFullYear());
  const range = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
  if (!range) return undefined;

  const [, month, day] = range;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function extractIsoDateFromText(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const cn = text.match(/(20\d{2})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (cn) {
    const [, y, m, d] = cn;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return undefined;
}
