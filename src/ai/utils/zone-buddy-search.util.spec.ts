import {
  buildZoneMatchEmptyReply,
  isZoneBuddySearchIntent,
  parseZoneBuddySearchLabel,
} from './zone-buddy-search.util';

describe('zone-buddy-search.util', () => {
  it('parses 13号A as zone label', () => {
    expect(parseZoneBuddySearchLabel('13号A')).toBe('13号A区');
    expect(isZoneBuddySearchIntent('13号A')).toBe(true);
  });

  it('detects explicit zone buddy question', () => {
    expect(isZoneBuddySearchIntent('13号A区有没有搭子')).toBe(true);
  });

  it('builds empty zone reply', () => {
    const reply = buildZoneMatchEmptyReply('风暴电音节', '13号A区');
    expect(reply).toContain('13号A区');
    expect(reply).toContain('搭子');
  });
});
