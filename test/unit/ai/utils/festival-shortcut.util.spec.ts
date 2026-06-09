import {
  STORM_FESTIVAL_ARTISTS,
  buildHomeFestivalShortcutReply,
  formatFestivalArtistLine,
  HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT,
  isHomeFestivalShortcutInput,
  resolveHomeFestivalShortcutCode,
} from '@src/ai/utils/festival-shortcut.util';

describe('festival-shortcut.util', () => {
  it('resolves storm chip submit text', () => {
    expect(resolveHomeFestivalShortcutCode('风暴电音节')).toBe('storm');
    expect(isHomeFestivalShortcutInput('风暴电音节')).toBe(true);
  });

  it('does not treat compound buddy messages as homepage shortcut chips', () => {
    expect(resolveHomeFestivalShortcutCode('风暴电音节 找组队')).toBe('storm');
    expect(isHomeFestivalShortcutInput('风暴电音节 找组队')).toBe(false);
  });

  it('uses exact storm artist lineup', () => {
    expect([...STORM_FESTIVAL_ARTISTS]).toEqual([
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
    ]);
  });

  it('builds storm reply with date, location, artists, and enter prompt', () => {
    const reply = buildHomeFestivalShortcutReply('storm', {
      name: '风暴电音节 深圳站',
      date: '06/13-14',
      location: '深圳国际会展中心',
      code: 'storm',
      legacyId: 4,
    } as never);

    expect(reply).toContain('风暴电音节 深圳站');
    expect(reply).toContain('06/13-14');
    expect(reply).toContain('深圳国际会展中心');
    expect(reply).toContain(formatFestivalArtistLine(STORM_FESTIVAL_ARTISTS));
    expect(reply).toContain(HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT);
    expect(reply).not.toContain('**');
    expect(reply).not.toContain('编号选择');
    expect(reply).toContain('直接回复活动名');
    expect(reply).toContain('不会自动绑定活动');
  });

  it('resolves tomorrowland and edc-thailand shortcuts', () => {
    expect(resolveHomeFestivalShortcutCode('Tomorrowland Thailand')).toBe(
      'tomorrowland',
    );
    expect(resolveHomeFestivalShortcutCode('EDC Thailand')).toBe(
      'edc-thailand',
    );
  });
});
