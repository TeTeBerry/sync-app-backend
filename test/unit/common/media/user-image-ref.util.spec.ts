import { BadRequestException } from '@nestjs/common';
import {
  assertUserImageRefSync,
  normalizeUserImageUrls,
  USER_IMAGE_MUST_UPLOAD_MESSAGE,
} from '@src/common/media/user-image-ref.util';

describe('user-image-ref.util', () => {
  const originalBase = process.env.UPLOAD_PUBLIC_BASE_URL;

  beforeAll(() => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
  });

  afterAll(() => {
    if (originalBase === undefined) {
      delete process.env.UPLOAD_PUBLIC_BASE_URL;
    } else {
      process.env.UPLOAD_PUBLIC_BASE_URL = originalBase;
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
});
