import {
  ACTIVITY_PICKER_PROMPT,
  buildNearEventsReply,
  filterUpcomingActivities,
} from '@src/ai/utils/activity-reply.util';

describe('activity-reply.util', () => {
  const now = new Date('2026-06-19T12:00:00+08:00');

  it('filters ended activities using title year hints', () => {
    const rows = [
      { name: '风暴电音节 深圳站 2026', date: '06/13-14' },
      { name: 'EDC Korea 2026', date: '10/03-04' },
    ];

    expect(filterUpcomingActivities(rows, now)).toEqual([
      { name: 'EDC Korea 2026', date: '10/03-04' },
    ]);
  });

  it('builds near-events reply with only upcoming activities', () => {
    const reply = buildNearEventsReply(
      [
        { name: '风暴电音节 深圳站 2026', date: '06/13-14', location: '深圳' },
        {
          name: 'Tomorrowland Thailand 2026',
          date: '12/11-13',
          location: '芭提雅',
        },
      ],
      now,
    );

    expect(reply).toContain('这些是平台近期热门活动');
    expect(reply).toContain('Tomorrowland Thailand 2026');
    expect(reply).not.toContain('风暴电音节');
    expect(reply).toContain(ACTIVITY_PICKER_PROMPT);
  });

  it('returns empty-state copy when all activities ended', () => {
    const reply = buildNearEventsReply(
      [{ name: '风暴电音节 深圳站 2026', date: '06/13-14' }],
      now,
    );

    expect(reply).toContain('暂时没有进行中的活动档期');
  });
});
