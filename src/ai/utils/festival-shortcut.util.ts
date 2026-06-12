import type { Activity } from '../../database/schemas/activity.schema';
import { composeReply } from './reply-text.util';
import { ACTIVITY_PICKER_PROMPT } from './activity-reply.util';

/** 风暴电音节 2026 深圳站官宣阵容（固定，勿改顺序与拼写） */
export const STORM_FESTIVAL_ARTISTS = [
  'MARSHMELLO',
  'Illenium',
  'Excision',
  'Eric Prydz',
  'ANDY C',
  'Odd Mob',
  'Julian Jordan',
  'BLONDEX',
  'GHENGAR',
  'Vidojean',
  'CRUSH',
  'CRUBBIXZ',
  'TIYA',
  'WHYBEATZ',
  'YOHAN',
] as const;

export type HomeFestivalShortcutCode =
  | 'storm'
  | 'tomorrowland'
  | 'edc-thailand';

export interface HomeFestivalShortcutDef {
  code: HomeFestivalShortcutCode;
  /** Chip label on homepage AI composer */
  chipLabel: string;
  /** User message sent on chip click */
  submitText: string;
  /** Catalog / seed name when DB row missing */
  fallbackName: string;
  fallbackDate: string;
  fallbackLocation: string;
  artists: readonly string[];
}

/** Homepage AI festival chips — aligned with activity catalog */
export const HOME_FESTIVAL_SHORTCUTS: readonly HomeFestivalShortcutDef[] = [
  {
    code: 'storm',
    chipLabel: '风暴电音节',
    submitText: '风暴电音节',
    fallbackName: '风暴电音节 深圳站',
    fallbackDate: '06/13-14',
    fallbackLocation: '深圳国际会展中心',
    artists: STORM_FESTIVAL_ARTISTS,
  },
  {
    code: 'tomorrowland',
    chipLabel: 'Tomorrowland',
    submitText: 'Tomorrowland Thailand',
    fallbackName: 'Tomorrowland Thailand 2026',
    fallbackDate: '12/11-13',
    fallbackLocation: '芭提雅 Wisdom Valley',
    artists: [
      'Swedish House Mafia',
      'Martin Garrix',
      'Afrojack',
      'Lost Frequencies',
      'NERVO',
      'Alok',
      'Dimitri Vegas',
    ],
  },
  {
    code: 'edc-thailand',
    chipLabel: 'EDC Thailand',
    submitText: 'EDC Thailand',
    fallbackName: 'EDC Thailand 2026',
    fallbackDate: '12/18-20',
    fallbackLocation: '普吉岛 Rhythm Park',
    artists: [
      'MARTIN GARRIX',
      'TIËSTO',
      'DJ SNAKE',
      'CHARLOTTE DE WITTE',
      'SUBTRONICS',
      'KASKADE',
      'DOM DOLLA',
      'VINTAGE CULTURE',
      '更多阵容见我的电音时间表',
    ],
  },
] as const;

const SUBMIT_TEXT_TO_CODE: Map<string, HomeFestivalShortcutCode> = (() => {
  const map = new Map<string, HomeFestivalShortcutCode>();
  for (const def of HOME_FESTIVAL_SHORTCUTS) {
    map.set(def.submitText.trim().toLowerCase(), def.code);
    map.set(def.chipLabel.trim().toLowerCase(), def.code);
    map.set(def.fallbackName.trim().toLowerCase(), def.code);
  }
  return map;
})();

export const HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT = '想进入哪个活动？';

export function resolveHomeFestivalShortcutCode(
  input: string,
): HomeFestivalShortcutCode | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const direct = SUBMIT_TEXT_TO_CODE.get(trimmed.toLowerCase());
  if (direct) return direct;

  for (const def of HOME_FESTIVAL_SHORTCUTS) {
    if (trimmed.includes(def.chipLabel) || trimmed.includes(def.fallbackName)) {
      return def.code;
    }
    if (
      def.code === 'edc-thailand' &&
      /edc/i.test(trimmed) &&
      /泰国|thailand/i.test(trimmed)
    ) {
      return def.code;
    }
    if (
      def.code === 'tomorrowland' &&
      /tomorrowland|tml|明日世界|tmw/i.test(trimmed)
    ) {
      return def.code;
    }
    if (def.code === 'storm' && /风暴|storm/i.test(trimmed)) {
      return def.code;
    }
  }

  return undefined;
}

/**
 * Chip / exact submit only. Compound messages like「风暴电音节 组队」are not shortcuts —
 * activity may still be inferred via chat for create_post.
 */
export function isHomeFestivalShortcutInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  const direct = SUBMIT_TEXT_TO_CODE.get(trimmed.toLowerCase());
  if (direct) return true;

  for (const def of HOME_FESTIVAL_SHORTCUTS) {
    if (
      trimmed === def.chipLabel ||
      trimmed === def.submitText ||
      trimmed === def.fallbackName
    ) {
      return true;
    }
  }

  return false;
}

function findShortcutDef(
  code: HomeFestivalShortcutCode,
): HomeFestivalShortcutDef {
  const def = HOME_FESTIVAL_SHORTCUTS.find((item) => item.code === code);
  if (!def) {
    throw new Error(`Unknown festival shortcut code: ${code}`);
  }
  return def;
}

function mergeCatalogMeta(
  def: HomeFestivalShortcutDef,
  activity?: Activity | null,
): { name: string; date: string; location: string } {
  return {
    name: activity?.name?.trim() || def.fallbackName,
    date: activity?.date?.trim() || def.fallbackDate,
    location: activity?.location?.trim() || def.fallbackLocation,
  };
}

export function formatFestivalArtistLine(artists: readonly string[]): string {
  return artists.join('、');
}

export function buildHomeFestivalShortcutReply(
  code: HomeFestivalShortcutCode,
  activity?: Activity | null,
): string {
  const def = findShortcutDef(code);
  const { name, date, location } = mergeCatalogMeta(def, activity);
  const artistLine = formatFestivalArtistLine(def.artists);

  return composeReply([
    `🎧 ${name}`,
    '',
    `📅 档期：${date}`,
    `📍 地点：${location}`,
    '',
    `🎤 艺人阵容：${artistLine}`,
    '',
    HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT,
    '',
    `直接回复活动名（如「${def.chipLabel}」）即可；我不会自动绑定活动，等你确认后再帮你了解活动或发帖。`,
  ]);
}

export async function buildHomeFestivalShortcutReplyFromCatalog(
  input: string,
  findByCode: (code: string) => Promise<Activity | null>,
): Promise<string | null> {
  const code = resolveHomeFestivalShortcutCode(input);
  if (!code) return null;

  const activity = await findByCode(code);
  return buildHomeFestivalShortcutReply(code, activity);
}

/** Used when listing activities after festival info — keep picker wording consistent */
export { ACTIVITY_PICKER_PROMPT };
