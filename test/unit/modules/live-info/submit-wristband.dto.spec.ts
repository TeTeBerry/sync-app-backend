import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitLiveInfoWristbandDto } from '@src/modules/live-info/dto/submit-wristband.dto';

describe('SubmitLiveInfoWristbandDto', () => {
  const originalEnv = process.env.CLOUDBASE_ENV_ID;
  const originalBase = process.env.UPLOAD_PUBLIC_BASE_URL;

  beforeAll(() => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.CLOUDBASE_ENV_ID;
    } else {
      process.env.CLOUDBASE_ENV_ID = originalEnv;
    }
    if (originalBase === undefined) {
      delete process.env.UPLOAD_PUBLIC_BASE_URL;
    } else {
      process.env.UPLOAD_PUBLIC_BASE_URL = originalBase;
    }
  });

  async function validateImageUrl(imageUrl: string) {
    const dto = plainToInstance(SubmitLiveInfoWristbandDto, { imageUrl });
    return validate(dto);
  }

  it('accepts CloudBase fileID', async () => {
    const errors = await validateImageUrl(
      'cloud://sync-prd-d7gquj4qk86da9bb2.7373-sync-prd/ugc/posts/user-1/1710000000000_abc.jpg',
    );
    expect(errors).toHaveLength(0);
  });

  it('accepts legacy local uploads URL in dev', async () => {
    const errors = await validateImageUrl(
      'http://127.0.0.1:3000/uploads/wristband.jpg',
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects plain hashtag text', async () => {
    const errors = await validateImageUrl('#同路');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects data URLs', async () => {
    const errors = await validateImageUrl('data:image/jpeg;base64,abc');
    expect(errors.some((e) => e.property === 'imageUrl')).toBe(true);
  });
});
