import { isDemoSeedEnabled } from '@src/common/utils/seed-policy.util';

describe('isDemoSeedEnabled', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.SEED_DEMO_DATA;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults to true when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    expect(isDemoSeedEnabled()).toBe(true);
  });

  it('defaults to false when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(isDemoSeedEnabled()).toBe(false);
  });

  it('SEED_DEMO_DATA=true overrides production default', () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_DEMO_DATA = 'true';
    expect(isDemoSeedEnabled()).toBe(true);
  });

  it('SEED_DEMO_DATA=false overrides development default', () => {
    process.env.NODE_ENV = 'development';
    process.env.SEED_DEMO_DATA = 'false';
    expect(isDemoSeedEnabled()).toBe(false);
  });
});
