import { ServiceUnavailableException } from '@nestjs/common';

export const MARKETING_AGENT_CLOUD_PREFIX = 'marketing-agent/';

export function assertMarketingAgentCloudFileId(fileId: string): void {
  const trimmed = fileId.trim();
  if (!trimmed.startsWith('cloud://')) {
    throw new ServiceUnavailableException('Invalid marketing image file id');
  }

  const withoutScheme = trimmed.slice('cloud://'.length);
  const slashIndex = withoutScheme.indexOf('/');
  if (slashIndex <= 0) {
    throw new ServiceUnavailableException('Invalid marketing image file id');
  }

  const objectPath = withoutScheme.slice(slashIndex + 1);
  if (
    !objectPath.startsWith(MARKETING_AGENT_CLOUD_PREFIX) ||
    objectPath.includes('..')
  ) {
    throw new ServiceUnavailableException('Invalid marketing image file id');
  }

  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim();
  if (!expectedEnv) {
    return;
  }

  const envSegment = withoutScheme.slice(0, slashIndex);
  if (!envSegment.startsWith(expectedEnv)) {
    throw new ServiceUnavailableException('Invalid marketing image file id');
  }
}
