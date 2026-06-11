import {
  assertUserUgcImageDataUrl,
  assertUserUgcImages,
} from '@src/common/media/user-ugc-image.util';
import type { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import type { MediaSecurityCheckService } from '@src/modules/media-security/media-security-check.service';

describe('user-ugc-image.util', () => {
  const security = {
    isEnabled: jest.fn(),
    assertImageSafe: jest.fn(),
  } as unknown as WechatContentSecurityService;

  const mediaChecks = {
    assertImagesApprovedForUser: jest.fn(),
  } as unknown as MediaSecurityCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips COS image approval when security is disabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(false);

    await assertUserUgcImages(
      security,
      mediaChecks,
      ['https://cdn.example.com/uploads/posts/u1/a.jpg'],
      'u1',
    );

    expect(mediaChecks.assertImagesApprovedForUser).not.toHaveBeenCalled();
  });

  it('requires approved COS images when security is enabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(true);

    await assertUserUgcImages(
      security,
      mediaChecks,
      ['https://cdn.example.com/uploads/posts/u1/a.jpg'],
      'u1',
    );

    expect(mediaChecks.assertImagesApprovedForUser).toHaveBeenCalledWith(
      ['https://cdn.example.com/uploads/posts/u1/a.jpg'],
      'u1',
    );
  });

  it('runs sync img_sec_check for inline data URLs when enabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(true);
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    await assertUserUgcImageDataUrl(security, tinyPng);

    expect(security.assertImageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: 'image/png',
        size: expect.any(Number),
        buffer: expect.any(Buffer),
      }),
    );
  });
});
