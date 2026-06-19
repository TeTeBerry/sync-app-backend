import { BadRequestException } from '@nestjs/common';
import {
  COMMENT_CONTACT_FORBIDDEN_MESSAGE,
  matchCommentContactInfo,
  matchPostContactInfo,
} from '../../../ai/risk/risk-rules.util';

export {
  COMMENT_CONTACT_FORBIDDEN_MESSAGE,
  POST_CONTACT_FORBIDDEN_MESSAGE,
} from '../../../ai/risk/risk-rules.util';

export function containsPostContactInfo(text: string): boolean {
  return matchPostContactInfo(text) != null;
}

export function containsCommentContactInfo(text: string): boolean {
  return matchCommentContactInfo(text) != null;
}

export function assertPostHasNoContactInfo(text: string): void {
  const match = matchPostContactInfo(text);
  if (match) {
    throw new BadRequestException(match.reason);
  }
}

export function assertCommentHasNoContactInfo(text: string): void {
  const match = matchCommentContactInfo(text);
  if (match) {
    throw new BadRequestException(match.reason);
  }
}
