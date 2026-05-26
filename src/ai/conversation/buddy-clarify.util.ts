import type { ConversationContext } from './conversation-context.parser';
import { buildKnownFactsSummary } from './conversation-context.parser';

const FIELD_QUESTIONS: Record<string, string> = {
  活动名称: '你想参加哪个活动？直接回复活动名（如 EDC、Ultra）即可。',
  出行时间: '计划哪天出发/到场？可以回复具体日期（如 2025-06-15）或相对时间（如「周五」）。',
  人数: '大概几个人同行？回复数字即可（如 2 或 3 人）。',
  性别偏好: '对同行伙伴有性别偏好吗？可以说「女生优先」「男生优先」或「不限」。',
};

export function buildBuddyClarifyReply(
  missing: string[],
  ctx: ConversationContext,
  activityName?: string,
): string {
  const nextField = missing[0];
  const question = FIELD_QUESTIONS[nextField] ?? `请补充：${nextField}`;

  const known = buildKnownFactsSummary(ctx, activityName);
  const hasKnown =
    known && known !== '收到，我先帮你查平台现有信息。';

  const lines = ['好的，我再确认几个细节 🎵'];

  if (activityName) {
    lines.push('', `当前活动：${activityName}`);
  }

  if (hasKnown) {
    lines.push('', known);
  }

  lines.push('', question);

  if (missing.length > 1) {
    lines.push('', `（还需：${missing.slice(1).join('、')}）`);
  }

  return lines.join('\n');
}
