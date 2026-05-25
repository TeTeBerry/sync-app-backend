const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor() {
    super('图片过大，请压缩至 10MB 以内后重试');
    this.name = 'ImageTooLargeError';
  }
}

export function decodeBase64Payload(image: string): {
  mimeType: string;
  base64: string;
  bytes: number;
} {
  const trimmed = image.trim();
  if (!trimmed) {
    throw new Error('图片数据为空');
  }

  let mimeType = 'image/jpeg';
  let base64 = trimmed;

  const dataUrlMatch = trimmed.match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2];
  }

  const bytes = Math.ceil((base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new ImageTooLargeError();
  }

  return { mimeType, base64, bytes };
}

export function toDataUrl(mimeType: string, base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
}
