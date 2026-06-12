import { pickRegeoLocationLabel } from '@src/modules/travel-guide/map/amap.service';

describe('pickRegeoLocationLabel', () => {
  it('prefers city + district label', () => {
    expect(
      pickRegeoLocationLabel({
        formatted_address: '广东省深圳市南山区科技园',
        addressComponent: {
          city: '深圳市',
          district: '南山区',
          province: '广东省',
        },
      }),
    ).toBe('深圳南山区');
  });

  it('falls back to formatted address', () => {
    expect(
      pickRegeoLocationLabel({
        formatted_address: '广东省深圳市南山区',
      }),
    ).toBe('广东省深圳市南山区');
  });
});
