import type { Activity } from '../../database/schemas/activity.schema';
import {
  formatFestivalArtistLine,
  type HomeFestivalShortcutCode,
  HOME_FESTIVAL_SHORTCUTS,
  resolveHomeFestivalShortcutCode,
} from './festival-shortcut.util';
import { ACTIVITY_PICKER_PROMPT } from './activity-reply.util';
import { composeReply } from './reply-text.util';

export const AI_GUIDE_SHORTCUT_TEXT = 'AI攻略';

const TRAVEL_GUIDE_INTENT_PATTERNS: RegExp[] = [
  /^规划$/,
  /^规划一下$/,
  /^做个?规划$/,
  /^安排(一下)?(行程|出行)$/,
  /^出行规划$/,
  /^要?(一份)?攻略$/,
  /帮我规划(一下)?行程/,
  /^规划(一下)?行程$/,
  /出行攻略/,
  /行程规划/,
  /(帮我)?(做|生成|出)(一份|个)?(出行|行程)?攻略/,
  /帮我安排(一下)?行程/,
  /帮我规划(一下)?(出行|去程|行程)/,
  /怎么(去|到|前往).{0,12}(会场|现场|音乐节|电音节)/,
];

export function isActivityGuideShortcut(input: string): boolean {
  return input.trim() === AI_GUIDE_SHORTCUT_TEXT;
}

/** AI 出行攻略：快捷词「AI攻略」或自然语言（如「帮我规划行程」） */
export function isTravelGuideIntent(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  if (isActivityGuideShortcut(text)) return true;
  if (text.replace(/\s+/g, '') === 'AI攻略') return true;
  return TRAVEL_GUIDE_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

function resolveShortcutCodeForActivity(
  activity: Activity,
): HomeFestivalShortcutCode | undefined {
  const code = activity.code?.trim().toLowerCase();
  if (code && HOME_FESTIVAL_SHORTCUTS.some((def) => def.code === code)) {
    return code as HomeFestivalShortcutCode;
  }
  return resolveHomeFestivalShortcutCode(activity.name ?? '');
}

export function buildActivityGuideReply(activity?: Activity | null): string {
  if (!activity) {
    return composeReply([
      '想了解哪场电音节的攻略？',
      '',
      ACTIVITY_PICKER_PROMPT,
      '也可以直接点下方活动名快捷按钮。',
    ]);
  }

  const shortcutCode = resolveShortcutCodeForActivity(activity);
  if (shortcutCode) {
    const def = HOME_FESTIVAL_SHORTCUTS.find(
      (item) => item.code === shortcutCode,
    );
    if (def) {
      const name = activity.name?.trim() || def.fallbackName;
      const date = activity.date?.trim() || def.fallbackDate;
      const location = activity.location?.trim() || def.fallbackLocation;
      const artistLine = formatFestivalArtistLine(def.artists);

      return composeReply([
        `🎧 ${name} · AI 攻略`,
        '',
        `📅 档期：${date}`,
        `📍 地点：${location}`,
        '',
        `🎤 艺人阵容：${artistLine}`,
        '',
        '你还可以：',
        '· 说「上海2人舒适自驾」或「帮我规划行程」生成交通/住宿/散场攻略长图；点「AI攻略」可用表单',
        '· 点「找队友 / 找拼卡」等找现有组队帖',
        '· 点「自己发帖」发布招募',
      ]);
    }
  }

  const lines = [`🎧 ${activity.name?.trim() || '本场活动'} · AI 攻略`, ''];
  if (activity.date?.trim()) {
    lines.push(`📅 档期：${activity.date.trim()}`);
  }
  if (activity.location?.trim()) {
    lines.push(`📍 地点：${activity.location.trim()}`);
  }
  lines.push(
    '',
    '一句话说出出发地、人数、预算即可生成攻略；点「AI攻略」可用表单。找现有帖请点「找队友」等快捷按钮。',
  );
  return composeReply(lines);
}
