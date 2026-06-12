import { BadRequestException } from '@nestjs/common';
import { USER_IMAGE_MUST_UPLOAD_MESSAGE } from '@src/common/media/user-image-ref.util';
import {
  resolveImageInput,
  validateImageRefSync,
} from '@src/ai/utils/image-ref.util';

describe('image-ref.util', () => {
  const originalBase = process.env.UPLOAD_PUBLIC_BASE_URL;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
    process.env.ENABLE_LOCAL_UPLOADS = 'true';
  });

  afterAll(() => {
    if (originalBase === undefined) {
      delete process.env.UPLOAD_PUBLIC_BASE_URL;
    } else {
      process.env.UPLOAD_PUBLIC_BASE_URL = originalBase;
    }
    global.fetch = originalFetch;
  });

  it('rejects data URLs', () => {
    expect(() => validateImageRefSync('data:image/png;base64,abc')).toThrow(
      BadRequestException,
    );
    expect(() => validateImageRefSync('data:image/png;base64,abc')).toThrow(
      USER_IMAGE_MUST_UPLOAD_MESSAGE,
    );
  });

  it('rejects external http URLs', () => {
    expect(() =>
      validateImageRefSync('https://evil.example.com/uploads/x.jpg'),
    ).toThrow(BadRequestException);
  });

  it('accepts localhost uploads URLs', () => {
    expect(() =>
      validateImageRefSync('http://127.0.0.1:3000/uploads/test.jpg'),
    ).not.toThrow();
  });

  it('resolveImageInput fetches allowed upload URL', async () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => tinyPng.buffer,
    }) as typeof fetch;

    const resolved = await resolveImageInput(
      'http://127.0.0.1:3000/uploads/test.png',
    );
    expect(resolved.startsWith('data:image/png')).toBe(true);
  });
});
