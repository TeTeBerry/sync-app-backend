import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { detectUserIntent } from '../intent/user-intent';

/** 与活动详情 / AI 助手「找组队、找拼房、找同路伙伴、找拼卡」等组队搜索相关的用户输入 */
const TEAM_SEARCH_PHRASE_RE =
  /找组队|找拼房|找同路伙伴|找拼卡|组队友|找搭子|找同行|结伴|帮我组队|帮我dd/i;

/**
 * 用户意图为「找同行/组队搜索」（快捷标签或自然语言），
 * 需先有自己的招募帖再推荐他人帖子。
 */
export function isBuddyTeamSearchIntent(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  if (isAiShortcutTag(text)) return true;
  if (detectUserIntent(text) === 'find_buddy') return true;
  return TEAM_SEARCH_PHRASE_RE.test(text);
}
