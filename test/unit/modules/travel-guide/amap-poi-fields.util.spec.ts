import {
  formatAmapTextField,
  parseAmapCost,
} from '@src/modules/travel-guide/map/amap-poi-fields.util';

describe('formatAmapTextField', () => {
  it('trims string values', () => {
    expect(formatAmapTextField(' 上海虹桥 ')).toBe('上海虹桥');
  });

  it('joins string array values from inputtips', () => {
    expect(formatAmapTextField(['闵行区', '虹桥火车站'])).toBe(
      '闵行区虹桥火车站',
    );
  });

  it('ignores empty and placeholder values', () => {
    expect(formatAmapTextField(undefined)).toBe('');
    expect(formatAmapTextField('[]')).toBe('');
    expect(formatAmapTextField([])).toBe('');
  });
});

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
