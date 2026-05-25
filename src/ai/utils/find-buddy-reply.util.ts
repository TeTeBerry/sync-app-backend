import type { FindBuddyState } from '../conversation/conversation-state.types';

export function getMissingFindBuddyFields(fb: FindBuddyState): string[] {
  const missing: string[] = [];
  if (!fb.activityId && !fb.activityKeyword) missing.push('活动名称');
  if (!fb.eventDate) missing.push('出行日期');
  if (!fb.peopleCount) missing.push('同行人数');
  if (!fb.city) missing.push('出发城市');
  return missing;
}

export function buildFindBuddyKnownLines(
  fb: FindBuddyState,
  activityName?: string,
  fromImage = false,
): string[] {
  const lines: string[] = [];
  const eventLabel =
    activityName ??
    fb.activityKeyword ??
    fb.activityId;

  if (eventLabel && eventLabel !== '未知活动') {
    lines.push(`· 活动：${eventLabel}`);
  }
  if (fb.packageName) lines.push(`· 套餐：${fb.packageName}`);
  if (fb.hotelName) lines.push(`· 酒店：${fb.hotelName}`);
  if (fb.location) lines.push(`· 地点：${fb.location}`);
  if (fb.eventDate) lines.push(`· 日期：${fb.eventDate}`);
  if (fb.peopleCount) lines.push(`· 人数：${fb.peopleCount} 人`);
  if (fb.packagePrice) {
    const suffix = fb.packageName?.match(/\d+\s*天\s*\d+\s*晚|\d+天\d+晚/)
      ? '（套餐总价）'
      : '（总价）';
    lines.push(`· 套餐价：¥${fb.packagePrice}${suffix}`);
  } else if (fb.budget) {
    lines.push(`· 预算：约 ¥${fb.budget}/人`);
  }
  if (fb.transportNote) lines.push(`· 交通：${fb.transportNote}`);
  if (fb.city) lines.push(`· 出发：${fb.city}`);

  if (!lines.length && fromImage) {
    return [];
  }

  return lines;
}

export function buildFindBuddyCollectingReply(
  fb: FindBuddyState,
  activityName?: string,
  fromImage = false,
): string {
  const known = buildFindBuddyKnownLines(fb, activityName, fromImage);
  const missing = getMissingFindBuddyFields(fb);
  const visionHint = fromImage
    ? '（部分信息已从图片识别，请核对）\n\n'
    : '';

  if (!known.length) {
    if (fromImage) {
      return [
        '已收到套餐/酒店截图，但未能识别出足够信息。',
        '',
        '请告诉我活动名称、出行日期、人数和出发城市；也可直接回复活动名（如 EDC、S2O、VAC）。',
      ].join('\n');
    }
    return '请告诉我你想参加的活动名称或序号，也可以上传套餐/酒店订单截图让我自动识别 🎵';
  }

  if (missing.length) {
    return [
      '已记录你的出行信息：',
      '',
      visionHint,
      ...known,
      '',
      `还缺：${missing.join('、')}。补充后我会为你匹配拼单。`,
      '',
      '也可直接回复活动名，或点顶部「创建拼单」发起新拼单。',
    ].join('\n');
  }

  return [
    '已记录你的出行信息：',
    '',
    visionHint,
    ...known,
  ].join('\n');
}

export function buildFindBuddyExclusionReply(excludedLabel: string): string {
  return `好的，已去掉「${excludedLabel}」。请告诉我你想参加的活动（如 S2O、Ultra），或上传套餐/酒店订单截图。`;
}

export function buildFindBuddyCreatePindanPrompt(
  fb: FindBuddyState,
  activityName?: string,
): string {
  const label = activityName ?? fb.activityKeyword ?? fb.activityId ?? '该活动';
  const known = buildFindBuddyKnownLines(fb, label, false);

  return [
    `「${label}」暂无进行中的拼单。`,
    '',
    known.length
      ? ['我可以根据以下信息帮你发起拼单：', '', ...known].join('\n')
      : '我可以根据你的需求帮你发起拼单。',
    '',
    '是否创建？回复「确认创建」即可发布；回复「不用了」可取消。',
    '也可点顶部「创建拼单」自行填写。',
  ].join('\n');
}

export function buildFindBuddyCreatedPindanReply(
  activityName: string,
  fb: FindBuddyState,
  groupSize: number,
  pricePerPerson: number,
): string {
  const known = buildFindBuddyKnownLines(fb, activityName, false);

  return [
    '已为你创建拼单，并已加入 🎉',
    '',
    ...(known.length ? [...known, ''] : []),
    `· 拼单人数：${groupSize} 人（${groupSize === 2 ? '大床/双床套餐，仅可 2 人拼' : `最多 ${groupSize} 人`}）`,
    pricePerPerson > 0 ? `· 人均：约 ¥${pricePerPerson}/人` : '',
    `· 状态：1/${groupSize} 人已加入，还差 ${Math.max(0, groupSize - 1)} 人`,
    '',
    '这是你发起的拼单，点击卡片可修改备注或价格；也可分享给朋友加入。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildFindBuddyBrowseReply(
  activityName: string,
  openCount: number,
  fb: FindBuddyState,
  fromImage = false,
): string {
  const known = buildFindBuddyKnownLines(fb, activityName, fromImage);
  const prefix =
    known.length > 0
      ? ['已从你的信息匹配拼单：', '', ...known, ''].join('\n')
      : '';

  if (openCount > 0) {
    return [
      prefix,
      `已为你找到「${activityName}」的拼单 🎵`,
      '',
      `当前有 ${openCount} 条可加入，点击下方卡片进入活动拼单页。`,
      '想加入回复序号（如「第一个」）；没有合适的可点「创建拼单」发起新拼单。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    prefix,
    `「${activityName}」暂无进行中的拼单。`,
    '',
    '我可以根据你的信息帮你发起拼单，是否创建？',
    '回复「确认创建」即可发布；回复「不用了」可取消。',
    '也可点顶部「创建拼单」自行填写。',
  ]
    .filter(Boolean)
    .join('\n');
}
