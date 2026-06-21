import path from 'node:path';

export function getCloudBaseUploadConfig() {
  return {
    envId: process.env.CLOUDBASE_ENV_ID?.trim() ?? '',
    appId: process.env.WECHAT_MINI_APP_ID?.trim() ?? '',
    appSecret: process.env.WECHAT_MINI_APP_SECRET?.trim() ?? '',
    storageBucket: process.env.CLOUDBASE_STORAGE_BUCKET?.trim() ?? '',
  };
}

export async function getWeChatAccessToken(appId, appSecret) {
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  const response = await fetch(url);
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error(payload.errmsg || 'Failed to fetch WeChat access token');
  }
  return payload.access_token;
}

export async function uploadBufferToCloudBase({
  envId,
  accessToken,
  cloudPath,
  buffer,
}) {
  const response = await fetch(
    `https://api.weixin.qq.com/tcb/uploadfile?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: envId,
        path: cloudPath,
      }),
    },
  );
  const payload = await response.json();

  if (payload.errcode && payload.errcode !== 0) {
    throw new Error(payload.errmsg || `uploadfile failed (${payload.errcode})`);
  }
  if (
    !payload.url ||
    !payload.token ||
    !payload.authorization ||
    !payload.cos_file_id
  ) {
    throw new Error(`uploadfile response incomplete for ${cloudPath}`);
  }

  const form = new FormData();
  form.append('key', cloudPath);
  form.append('Signature', payload.authorization);
  form.append('x-cos-security-token', payload.token);
  form.append('x-cos-meta-fileid', payload.cos_file_id);
  form.append('file', new Blob([buffer]), path.basename(cloudPath));

  const uploadResponse = await fetch(payload.url, {
    method: 'POST',
    body: form,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(
      `COS upload failed for ${cloudPath}: ${uploadResponse.status} ${text}`,
    );
  }

  return payload.file_id ?? `cloud://${envId}/${cloudPath}`;
}

export function buildCloudFileId(envId, assetKey, storageBucket = '') {
  const key = assetKey.trim();
  const env = envId.trim();
  const bucket = storageBucket.trim();
  if (!key || !env) {
    return '';
  }
  if (bucket) {
    return `cloud://${env}.${bucket}/${key}`;
  }
  return `cloud://${env}/${key}`;
}
