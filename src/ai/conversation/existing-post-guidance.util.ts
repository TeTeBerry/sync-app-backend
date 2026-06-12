/** 用户希望放弃旧帖、重新发帖 */
export function isExplicitReplacePostIntent(input: string): boolean {
  const text = input.trim();
  return /重新发帖|重新发贴|再发一条|换一条|重新发|新发一条/.test(text);
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
      `你已在「${activityLabel}」有一条帖子 📌`,
      '',
      `当前帖子：${snippet}`,
      '',
      '每位用户同类型只能发布一篇帖子。你可以编辑原帖补充信息：',
      '· 「我的」→ 我的帖子 → 编辑',
      '· 或在活动详情页查看你的帖子',
    );
  } else {
    lines.push(
      `你已在「${activityLabel}」有一条帖子 📌`,
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
