import { BadRequestException } from '@nestjs/common';
import { matchPostContactInfo } from '../../../ai/risk/risk-rules.util';

export { POST_CONTACT_FORBIDDEN_MESSAGE } from '../../../ai/risk/risk-rules.util';

export function containsPostContactInfo(text: string): boolean {
  return matchPostContactInfo(text) != null;
}

export function assertPostHasNoContactInfo(text: string): void {
  const match = matchPostContactInfo(text);
  if (match) {
    throw new BadRequestException(match.reason);
  }
}
