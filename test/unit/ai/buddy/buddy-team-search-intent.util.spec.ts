import { isBuddyTeamSearchIntent } from '@src/ai/buddy/buddy-team-search-intent.util';

describe('buddy-team-search-intent.util', () => {
  it('treats shortcut tags as team search', () => {
    expect(isBuddyTeamSearchIntent('找队友')).toBe(true);
    expect(isBuddyTeamSearchIntent('找拼房')).toBe(true);
    expect(isBuddyTeamSearchIntent('找拼车')).toBe(true);
    expect(isBuddyTeamSearchIntent('找拼卡')).toBe(true);
    expect(isBuddyTeamSearchIntent('组队队友')).toBe(true);
    expect(isBuddyTeamSearchIntent('帮我dd')).toBe(true);
  });

  it('treats natural language find-buddy phrases as team search', () => {
    expect(isBuddyTeamSearchIntent('找搭子一起')).toBe(true);
    expect(isBuddyTeamSearchIntent('上海找拼房')).toBe(true);
  });

  it('does not treat unrelated input as team search', () => {
    expect(isBuddyTeamSearchIntent('AI攻略')).toBe(false);
    expect(isBuddyTeamSearchIntent('确认发布')).toBe(false);
  });
});
