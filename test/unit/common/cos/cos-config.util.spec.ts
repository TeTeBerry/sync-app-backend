import {
  defaultCosUploadResource,
  resolveCosPublicBaseUrl,
  resolveCosPublicHost,
} from '../../../../src/common/cos/cos-config.util';

describe('cos-config.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.COS_BUCKET;
    delete process.env.COS_REGION;
    delete process.env.COS_PUBLIC_BASE_URL;
    delete process.env.COS_APP_ID;
  });

  afterAll(() => {
    process.env = env;
  });

  it('derives public base URL from bucket and region', () => {
    process.env.COS_BUCKET = 'my-bucket-99';
    process.env.COS_REGION = 'ap-guangzhou';
    expect(resolveCosPublicBaseUrl()).toBe(
      'https://my-bucket-99.cos.ap-guangzhou.myqcloud.com',
    );
    expect(resolveCosPublicHost()).toBe(
      'my-bucket-99.cos.ap-guangzhou.myqcloud.com',
    );
  });

  it('uses COS_PUBLIC_BASE_URL when set', () => {
    process.env.COS_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    expect(resolveCosPublicBaseUrl()).toBe('https://cdn.example.com');
  });

  it('builds default STS upload resource ARN', () => {
    process.env.COS_BUCKET = 'syncapp-1304288643';
    process.env.COS_REGION = 'ap-shanghai';
    expect(defaultCosUploadResource()).toBe(
      'qcs::cos:ap-shanghai:uid/1304288643:syncapp-1304288643/uploads/posts/{userId}/*',
    );
  });
});
