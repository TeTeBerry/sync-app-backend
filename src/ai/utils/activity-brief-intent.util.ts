/** 活动内基础信息问答（时间/地点/这场活动），走 Agent get_activity_brief */
export function isActivityBriefIntent(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 80) {
    return false;
  }

  return /活动|这场|本场|几点|在哪|哪里|什么时候|什么时候开始|几点开始|几点结束|地址|地点/.test(
    text,
  );
}
