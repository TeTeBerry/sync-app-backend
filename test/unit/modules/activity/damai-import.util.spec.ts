/* eslint-disable @typescript-eslint/no-var-requires */
const {
  normalizeDamaiShowtime,
  normalizeDamaiVerticalPicUrl,
  formatDamaiLocation,
  parseDamaiSearchPayload,
  damaiDetailUrl,
  resolveDamaiActivityCode,
  isDamaiItemBlocked,
} = require('../../../../scripts/lib/damai-import.util.js');

describe('damai-import.util', () => {
  it('normalizes nested alicdn verticalPic URLs', () => {
    expect(
      normalizeDamaiVerticalPicUrl(
        'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
      ),
    ).toBe(
      'https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
    );
    expect(
      normalizeDamaiVerticalPicUrl(
        'https://img.alicdn.com/bao/uploaded/i3/2251059038/O1CN01DqHXff2GdSmNgmavM_!!4611686018427383646-0-item_pic.jpg',
      ),
    ).toBe(
      'https://img.alicdn.com/bao/uploaded/i3/2251059038/O1CN01DqHXff2GdSmNgmavM_!!4611686018427383646-0-item_pic.jpg',
    );
  });

  it('sets normalized image on parsed items', () => {
    const { items } = parseDamaiSearchPayload({
      pageData: {
        resultData: [
          {
            name: '2026口味王风暴电音节-深圳站',
            projectid: 1048730418844,
            showtime: '2026.06.13-06.14',
            verticalPic:
              'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
          },
        ],
      },
    });
    expect(items[0].image).toBe(
      'https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
    );
  });

  it('normalizes same-month showtime', () => {
    expect(normalizeDamaiShowtime('2026.05.30-05.31')).toBe('05/30-31');
    expect(normalizeDamaiShowtime('2026.06.13-06.14')).toBe('06/13-14');
  });

  it('normalizes cross-day range within month', () => {
    expect(normalizeDamaiShowtime('2026.06.19-06.28')).toBe('06/19-28');
  });

  it('formats location with city', () => {
    expect(formatDamaiLocation('深圳国际会展中心17号馆', '深圳')).toBe(
      '深圳国际会展中心17号馆（深圳）',
    );
  });

  it('builds damai detail URL from projectid', () => {
    expect(damaiDetailUrl(1048730418844)).toBe(
      'https://detail.damai.cn/item.htm?id=1048730418844',
    );
  });

  it('maps storm深圳 to existing catalog code', () => {
    expect(
      resolveDamaiActivityCode({
        name: '2026口味王风暴电音节-深圳站',
        projectid: 1048730418844,
      }),
    ).toBe('storm');
  });

  it('filters names by 电音节 and skips 电音汇', () => {
    const payload = {
      pageData: {
        resultData: [
          { name: 'GUAN电音节', projectid: 1, showtime: '2026.05.30-05.31' },
          {
            name: '天上村前·苏荟新年电音汇',
            projectid: 2,
            showtime: '2026.06.19-06.20',
          },
        ],
      },
    };
    const { items, skipped } = parseDamaiSearchPayload(payload);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('GUAN电音节');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('电音节');
  });

  it('sets curated attendee count for GUAN电音节', () => {
    const { items } = parseDamaiSearchPayload({
      pageData: {
        resultData: [
          {
            name: 'GUAN电音节',
            projectid: 1045457803269,
            showtime: '2026.05.30-05.31',
          },
        ],
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].attendees).toBe(128);
  });
});
