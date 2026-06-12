import {
  assertUserUgcImageDataUrl,
  assertUserUgcImages,
  assertUserUgcRemoteImageUrl,
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

  it('skips legacy upload approval when security is disabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(false);

    await assertUserUgcImages(
      security,
      mediaChecks,
      ['https://cdn.example.com/uploads/posts/u1/a.jpg'],
      'u1',
    );

    expect(mediaChecks.assertImagesApprovedForUser).not.toHaveBeenCalled();
  });

  it('requires approved legacy upload URLs when security is enabled', async () => {
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

  it('skips cloud fileIDs (no server-side media_check record)', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(true);

    await assertUserUgcImages(
      security,
      mediaChecks,
      ['cloud://env.x/ugc/posts/u1/a.jpg'],
      'u1',
    );

    expect(mediaChecks.assertImagesApprovedForUser).not.toHaveBeenCalled();
  });

  it('skips remote image check when security is disabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(false);
    const fetchSpy = jest.spyOn(global, 'fetch');

    await assertUserUgcRemoteImageUrl(
      security,
      'https://wx.qlogo.cn/mmopen/avatar.png',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('runs sync img_sec_check for remote HTTPS images when enabled', async () => {
    (security.isEnabled as jest.Mock).mockReturnValue(true);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    } as unknown as Response);

    await assertUserUgcRemoteImageUrl(
      security,
      'https://wx.qlogo.cn/mmopen/avatar.png',
    );

    expect(security.assertImageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: 'image/png',
        size: 3,
        buffer: expect.any(Buffer),
      }),
    );
    fetchSpy.mockRestore();
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
