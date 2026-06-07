import {
  describeCorsPolicy,
  parseCorsOrigins,
  resolveCorsOrigin,
  resolveCorsOptions,
} from '../../../../src/common/cors/cors-config.util';

describe('cors-config.util', () => {
  it('parses comma-separated origins', () => {
    expect(parseCorsOrigins('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('treats lone * as wildcard', () => {
    expect(parseCorsOrigins('*')).toEqual(['*']);
    expect(resolveCorsOrigin('production', ['*'])).toBe(true);
  });

  it('disables CORS in production when unset', () => {
    expect(resolveCorsOrigin('production', null)).toBe(false);
    expect(describeCorsPolicy('production', null)).toContain('disabled');
  });

  it('whitelists origins in production when configured', () => {
    const origins = ['https://h5.example.com'];
    expect(resolveCorsOrigin('production', origins)).toEqual(origins);
    expect(describeCorsPolicy('production', origins)).toContain(
      'https://h5.example.com',
    );
  });

  it('reflects any origin in development when unset', () => {
    expect(resolveCorsOrigin('development', null)).toBe(true);
    expect(describeCorsPolicy('development', null)).toContain('dev mode');
  });

  it('restricts allowedHeaders to production', () => {
    expect(
      resolveCorsOptions('development', null).allowedHeaders,
    ).toBeUndefined();
    expect(
      resolveCorsOptions('production', ['https://h5.example.com'])
        .allowedHeaders,
    ).toEqual(expect.arrayContaining(['Authorization', 'X-Activity-Id']));
  });
});
