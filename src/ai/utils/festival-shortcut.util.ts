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
] as const;

export type HomeFestivalShortcutCode =
  | 'storm'
  | 'edc'
  | 'tomorrowland'
  | 'vac-zhuhai'
  | 'guan'
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

/** Homepage AI festival chips — aligned with activity catalog + Damai GUAN */
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
    code: 'edc',
    chipLabel: 'EDC China',
    submitText: 'EDC China',
    fallbackName: 'EDC China 2025',
    fallbackDate: '03/22-23',
    fallbackLocation: '苏州阳澄湖半岛旅游度假区',
    artists: [
      'MARSHMELLO',
      'ILLENIUM',
      'THE CHAINSMOKERS',
      'AFROJACK B2B R3HAB',
      '999999999',
      'Axwell',
      'Valentino Khan',
      'ACRAZE',
      'Sub Zero Project',
    ],
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
    code: 'vac-zhuhai',
    chipLabel: 'VAC横琴',
    submitText: '横琴VAC电音节',
    fallbackName: '2026横琴VAC电音节',
    fallbackDate: '04/18-19',
    fallbackLocation: '横琴长隆度假区',
    artists: [
      'Kygo',
      'John Summit',
      'Porter Robinson',
      'Charlotte de Witte',
      'SLANDER',
      'Gorgon City',
      'Gryffin',
      'Odd Mob',
      'Ray Volpe',
      'Markus Schulz',
    ],
  },
  {
    code: 'guan',
    chipLabel: 'GUAN电音节',
    submitText: 'GUAN电音节',
    fallbackName: 'GUAN电音节',
    fallbackDate: '05/30-31',
    fallbackLocation: '广东现代国际展览中心（东莞）',
    artists: [
      'Nicky Romero',
      'MORTEN',
      'MUST DIE!',
      'OOKAY',
      'T78',
      'AN21',
      'RetroVision',
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
      '阵容陆续公布中',
      '可关注 EDC Thailand 官方渠道',
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
    if (def.code === 'edc' && /\bedc\b/i.test(trimmed) && !/泰国|thailand/i.test(trimmed)) {
      return def.code;
    }
    if (def.code === 'edc-thailand' && /edc/i.test(trimmed) && /泰国|thailand/i.test(trimmed)) {
      return def.code;
    }
    if (def.code === 'tomorrowland' && /tomorrowland|tml|明日世界|tmw/i.test(trimmed)) {
      return def.code;
    }
    if (def.code === 'vac-zhuhai' && /vac|横琴|vision/i.test(trimmed)) {
      return def.code;
    }
    if (def.code === 'guan' && /guan/i.test(trimmed)) {
      return def.code;
    }
    if (def.code === 'storm' && /风暴|storm/i.test(trimmed)) {
      return def.code;
    }
  }

  return undefined;
}

/**
 * Chip / exact submit only. Compound messages like「风暴电音节 找队友」are not shortcuts —
 * activity may still be inferred via chat for buddy recommend / create_post.
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

function findShortcutDef(code: HomeFestivalShortcutCode): HomeFestivalShortcutDef {
  const def = HOME_FESTIVAL_SHORTCUTS.find(item => item.code === code);
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
    `直接回复活动名（如「${def.chipLabel}」）即可；我不会自动绑定活动，等你确认后再帮你找队友或发帖。`,
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
