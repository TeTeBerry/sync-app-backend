/**
 * 冒烟：海报/营销生图（POSTER_BACKGROUND_IMAGE_MODEL）
 * 用法：node scripts/smoke-poster-background.mjs
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });

const envId = process.env.CLOUDBASE_ENV_ID?.trim();
const imageModel = process.env.POSTER_BACKGROUND_IMAGE_MODEL?.trim();
const accessKey =
  process.env.CLOUDBASE_APIKEY?.trim() || process.env.HUNYUAN_API_KEY?.trim();

if (!envId) {
  console.error('缺少 CLOUDBASE_ENV_ID');
  process.exit(1);
}
if (!imageModel) {
  console.error('缺少 POSTER_BACKGROUND_IMAGE_MODEL');
  process.exit(1);
}
if (!accessKey) {
  console.error('缺少 CLOUDBASE_APIKEY / HUNYUAN_API_KEY');
  process.exit(1);
}

const cloudbase = (await import('@cloudbase/node-sdk')).default;
const initOptions = { env: envId, timeout: 90_000 };
initOptions.accessKey = accessKey;

const app = cloudbase.init(initOptions);
const client = app.ai().createImageModel(imageModel);

console.log(`generating test image (${imageModel}, 720x1280)...`);
const res = await client.generateImage({
  model: imageModel,
  prompt: '抽象电音节舞台霓虹灯光，紫粉蓝色调，无文字无人物，适合手机壁纸背景',
  size: '720x1280',
  version: process.env.POSTER_BACKGROUND_IMAGE_VERSION?.trim() || 'v1.9',
  revise: false,
});

const url = res?.data?.[0]?.url;
if (!url) {
  console.error('生图失败：无 url', res);
  process.exit(1);
}

console.log('OK:', url.slice(0, 120) + '...');
