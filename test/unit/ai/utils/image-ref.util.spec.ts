import { BadRequestException } from '@nestjs/common';
import {
  resolveImageInput,
  validateImageRefSync,
} from '@src/ai/utils/image-ref.util';

describe('image-ref.util', () => {
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('accepts data URLs', async () => {
    const dataUrl = `data:image/png;base64,${tinyPngBase64}`;
    validateImageRefSync(dataUrl);
    const resolved = await resolveImageInput(dataUrl);
    expect(resolved.startsWith('data:image/png')).toBe(true);
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
});
