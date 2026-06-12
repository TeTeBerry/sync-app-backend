import { isLegacyLocalUploadEnabled } from '@src/common/media/local-upload.util';

describe('isLegacyLocalUploadEnabled', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_LOCAL_UPLOADS;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalFlag === undefined) {
      delete process.env.ENABLE_LOCAL_UPLOADS;
    } else {
      process.env.ENABLE_LOCAL_UPLOADS = originalFlag;
    }
  });

  it('is enabled in non-production by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_LOCAL_UPLOADS;
    expect(isLegacyLocalUploadEnabled()).toBe(true);
  });

  it('is disabled in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_LOCAL_UPLOADS;
    expect(isLegacyLocalUploadEnabled()).toBe(false);
  });

  it('can be forced on in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_LOCAL_UPLOADS = 'true';
    expect(isLegacyLocalUploadEnabled()).toBe(true);
  });
});
