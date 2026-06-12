import { parseAmapCost } from '@src/modules/travel-guide/map/amap-poi-fields.util';

describe('parseAmapCost', () => {
  it('accepts numeric cost from Amap biz_ext', () => {
    expect(parseAmapCost(88)).toBe(88);
  });

  it('accepts string cost', () => {
    expect(parseAmapCost('120')).toBe(120);
  });

  it('accepts string array cost', () => {
    expect(parseAmapCost(['80'])).toBe(80);
  });

  it('ignores empty and invalid values', () => {
    expect(parseAmapCost(undefined)).toBeUndefined();
    expect(parseAmapCost('[]')).toBeUndefined();
    expect(parseAmapCost({} as unknown as string)).toBeUndefined();
  });
});
