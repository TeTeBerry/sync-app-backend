import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isExactQuickReply } from '../intent/user-intent';

/** 用户希望放弃旧帖、重新发帖 */
export function isExplicitReplacePostIntent(input: string): boolean {
  const text = input.trim();
  return /重新发帖|重新发贴|再发一条|换一条|重新发|新发一条/.test(text);
}

/** 口语化组队帖正文（非结构化槽位回答） */
export function isInformalPostBodyInput(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 80) return false;
  if (isExplicitReplacePostIntent(text)) return false;
  if (isAiShortcutTag(text) || isExactQuickReply(text)) return false;

  if (
    /(有人吗|有没有人|有没有\s*搭子|看看|搜一下|查一下|类似的|相似的)/.test(
      text,
    )
  ) {
    return false;
  }

  if (/^cpdd$/i.test(text)) return true;
  if (/dd|搭子|求组|求带|cpdd|一起组|一起冲/.test(text) && text.length >= 4) {
    return true;
  }
  if (/\d+\s*号.*区/.test(text) && /dd|搭子|cpdd|组队|求组/.test(text)) {
    return true;
  }

  return false;
}

/** 发帖正文补充（人数、预算等），不含「某区有没有搭子」类搜索 */
export function isSupplementDetailInput(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 40) return false;
  if (/(有人吗|有没有人|有没有\s*搭子)/.test(text)) return false;
  if (/(\d{1,2})\s*号\s*([A-Za-z])?\s*区?/.test(text) && text.length <= 28) {
    return false;
  }
  if (/^\d+\s*人$/.test(text)) return true;
  if (/^\d+\s*个?$/.test(text)) return true;
  if (/^\d{3,5}$/.test(text)) return true;
  return false;
}

export function buildExistingPostGuidanceReply(params: {
  activityLabel: string;
  postBody: string;
  supplement?: string;
  fromSelfPostIntent?: boolean;
}): string {
  const { activityLabel, postBody, supplement, fromSelfPostIntent } = params;
  const snippet = postBody.length > 80 ? `${postBody.slice(0, 80)}…` : postBody;

  const lines: string[] = [];

  if (fromSelfPostIntent) {
    lines.push(
      `你已在「${activityLabel}」有一条招募中的组队帖 📌`,
      '',
      `当前帖子：${snippet}`,
      '',
      '每位用户同类型只能发布一篇帖子。你可以编辑原帖补充信息：',
      '· 「我的」→ 我的帖子 → 编辑',
      '· 或在活动详情页查看你的帖子',
    );
  } else {
    lines.push(
      `你已在「${activityLabel}」有一条招募中的组队帖 📌`,
      '',
      `当前帖子：${snippet}`,
    );

    if (supplement?.trim()) {
      lines.push(
        '',
        `收到「${supplement.trim()}」。这类信息建议写进原帖，而不是再发一条：`,
        '· 打开「我的」→ 我的帖子 → 编辑',
        '· 或在活动详情页找到你的帖子查看、补充',
      );
    } else {
      lines.push(
        '',
        '如需补充场次、座位、人数等，请编辑原帖：',
        '· 「我的」→ 我的帖子 → 编辑',
        '· 或在活动详情页查看你的帖子',
      );
    }

    lines.push('', '若要重新发一条，请回复「重新发帖」。');
  }

  return lines.join('\n');
}
