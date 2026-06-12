import { BadRequestException } from '@nestjs/common';
import {
  assertUserImageRefSync,
  isCloudBaseTempImageUrl,
  normalizeUserImageUrls,
  USER_IMAGE_MUST_UPLOAD_MESSAGE,
} from '@src/common/media/user-image-ref.util';

describe('user-image-ref.util', () => {
  const originalBase = process.env.UPLOAD_PUBLIC_BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableLocalUploads = process.env.ENABLE_LOCAL_UPLOADS;

  beforeAll(() => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_LOCAL_UPLOADS;
  });

  afterAll(() => {
    if (originalBase === undefined) {
      delete process.env.UPLOAD_PUBLIC_BASE_URL;
    } else {
      process.env.UPLOAD_PUBLIC_BASE_URL = originalBase;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalEnableLocalUploads === undefined) {
      delete process.env.ENABLE_LOCAL_UPLOADS;
    } else {
      process.env.ENABLE_LOCAL_UPLOADS = originalEnableLocalUploads;
    }
  });

  it('rejects data URLs', () => {
    expect(() => assertUserImageRefSync('data:image/png;base64,abc')).toThrow(
      BadRequestException,
    );
    expect(() => assertUserImageRefSync('data:image/png;base64,abc')).toThrow(
      USER_IMAGE_MUST_UPLOAD_MESSAGE,
    );
  });

  it('rejects external http URLs', () => {
    expect(() =>
      assertUserImageRefSync('https://evil.example.com/uploads/x.jpg'),
    ).toThrow(BadRequestException);
  });

  it('accepts localhost uploads URLs', () => {
    expect(() =>
      assertUserImageRefSync('http://127.0.0.1:3000/uploads/test.jpg'),
    ).not.toThrow();
  });

  it('rejects external HTTPS upload URLs', () => {
    expect(() =>
      assertUserImageRefSync(
        'https://syncapp-1304288643.cos.ap-shanghai.myqcloud.com/uploads/posts/user-1/1710000000000_abc.jpg',
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts CloudBase temp image URLs under ugc/', () => {
    expect(
      isCloudBaseTempImageUrl(
        'https://636c-sync-prd.tcb.qcloud.la/ugc/posts/user-1/abc.jpg',
      ),
    ).toBe(true);
    expect(
      isCloudBaseTempImageUrl(
        'https://syncapp-1304288643.cos.ap-shanghai.myqcloud.com/ugc/posts/user-1/abc.jpg',
      ),
    ).toBe(true);
    expect(
      isCloudBaseTempImageUrl('https://evil.example.com/ugc/posts/x.jpg'),
    ).toBe(false);
  });

  it('normalizes allowed URL list', () => {
    expect(
      normalizeUserImageUrls([
        ' http://127.0.0.1:3000/uploads/a.jpg ',
        'http://127.0.0.1:3000/uploads/b.png',
      ]),
    ).toEqual([
      'http://127.0.0.1:3000/uploads/a.jpg',
      'http://127.0.0.1:3000/uploads/b.png',
    ]);
  });

  it('accepts CloudBase fileID under ugc/', () => {
    const fileId =
      'cloud://sync-prd-d7gquj4qk86da9bb2.7373-sync-prd/ugc/posts/user-1/1710000000000_abc.jpg';
    expect(() => assertUserImageRefSync(fileId)).not.toThrow();
    expect(normalizeUserImageUrls([fileId])).toEqual([fileId]);
  });

  it('rejects cloud fileID outside ugc/', () => {
    expect(() =>
      assertUserImageRefSync('cloud://env-id.bucket/other/secret.jpg'),
    ).toThrow(BadRequestException);
  });

  it('rejects legacy /uploads/ URLs when local uploads disabled', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevFlag = process.env.ENABLE_LOCAL_UPLOADS;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_LOCAL_UPLOADS;
    try {
      expect(() =>
        assertUserImageRefSync('http://127.0.0.1:3000/uploads/test.jpg'),
      ).toThrow(BadRequestException);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevFlag === undefined) delete process.env.ENABLE_LOCAL_UPLOADS;
      else process.env.ENABLE_LOCAL_UPLOADS = prevFlag;
    }
  });
});
