import { assertMarketingAgentCloudFileId } from '../../../../src/modules/marketing-ai/utils/marketing-agent-cloud-ref.util';

describe('marketing-agent-cloud-ref.util', () => {
  const originalEnv = process.env.CLOUDBASE_ENV_ID;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLOUDBASE_ENV_ID;
    } else {
      process.env.CLOUDBASE_ENV_ID = originalEnv;
    }
  });

  it('accepts marketing-agent cloud file ids with bucket suffix', () => {
    process.env.CLOUDBASE_ENV_ID = 'sync-prd-test';

    expect(() =>
      assertMarketingAgentCloudFileId(
        'cloud://sync-prd-test.bucket/marketing-agent/generated/images/2026-07-06/slide-1.png',
      ),
    ).not.toThrow();
  });

  it('rejects non-marketing paths', () => {
    expect(() =>
      assertMarketingAgentCloudFileId(
        'cloud://sync-prd-test.bucket/ugc/posts/user-1/shot.jpg',
      ),
    ).toThrow('Invalid marketing image file id');
  });
});
