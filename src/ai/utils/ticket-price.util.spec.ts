import {
  formatSlotPrice,
  getDraftPriceBounds,
  pricesOverlap,
} from './ticket-price.util';

describe('pricesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(pricesOverlap({ min: 800, max: 1000 }, { min: 900, max: 1100 })).toBe(
      true,
    );
  });

  it('rejects non-overlapping ranges', () => {
    expect(pricesOverlap({ min: 800, max: 900 }, { min: 1000, max: 1200 })).toBe(
      false,
    );
  });
});

describe('getDraftPriceBounds', () => {
  it('uses priceMax when set', () => {
    expect(getDraftPriceBounds({ price: 500, priceMax: 800 })).toEqual({
      min: 500,
      max: 800,
    });
  });
});

describe('formatSlotPrice', () => {
  it('formats range', () => {
    expect(formatSlotPrice({ price: 600, priceMax: 900 })).toBe('¥600-900');
  });
});
