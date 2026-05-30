export const WRISTBAND_VERIFY_JSON_SCHEMA = [
  '只输出 JSON，字段：',
  '- isWristband: boolean，照片中是否为佩戴在手腕/手臂上的活动入场腕带',
  '- confidence: number，0~1，判断置信度',
  '- reason: string，简短中文说明（通过或拒绝原因，30字内）',
  '- rejectCode: string | null，拒绝时为 not_wristband | not_on_wrist | unclear | screenshot | other；通过时为 null',
].join('\n');

export function buildWristbandVerifySystemPrompt(): string {
  return [
    '你是电音/音乐节现场手环认证审核助手。用户上传照片用于证明已到场并佩戴官方入场腕带。',
    '',
    '【应通过的典型特征】（满足大部分即可，不要求文字完全一致）',
    '- 真人手腕或手臂上佩戴一次性活动腕带（塑料/布艺/RFID 腕带）',
    '- 腕带为条形，常有活动 Logo、GA/VIP、中英文场次或「观众」等字样',
    '- 常见参考样式：浅粉色腕带，印有 Budweiser STORM 或 STORM 标识、「GA」与「观众」、啤酒杯图标或可撕副券',
    '- 允许略模糊，但腕带主体需可辨认；可看到锁扣/铆钉',
    '',
    '【应拒绝】',
    '- 无腕带：风景、自拍脸部、舞台远景、票根/电子票截图、订单截图',
    '- 腕带未佩戴：手持腕带、桌面摆放、包装盒',
    '- 非现场凭证：普通手表/手链/橡皮筋、打印纸、表情包、纯黑/纯白图',
    '- 明显 PS、网图、屏幕翻拍另一张图',
    '',
    '若提供了活动名称，可弱参考是否像该活动的腕带样式，但勿因 Logo 不完全一致而误杀其他合法腕带。',
    WRISTBAND_VERIFY_JSON_SCHEMA,
  ].join('\n');
}

export function buildWristbandVerifyUserPrompt(input: {
  activityName?: string;
  activityAliases?: string[];
}): string {
  const lines = ['请判断该照片是否可作为「已佩戴官方活动入场腕带」的认证。'];
  if (input.activityName?.trim()) {
    lines.push(`关联活动：${input.activityName.trim()}`);
  }
  const aliases = (input.activityAliases ?? []).filter(Boolean).slice(0, 5);
  if (aliases.length) {
    lines.push(`活动别名：${aliases.join('、')}`);
  }
  return lines.join('\n');
}
