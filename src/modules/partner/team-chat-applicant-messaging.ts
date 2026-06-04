/** Shown when applicant hits team-chat send limit before post owner replies. */
export const APPLICANT_MESSAGING_LIMIT_HINT =
  '对方回复你之前，24小时内最多只能发1条文字消息';

export const APPLICANT_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canApplicantSendBeforeOwnerReply(input: {
  ownerHasReplied: boolean;
  applicantMessageCount: number;
}): boolean {
  if (input.ownerHasReplied) return true;
  return input.applicantMessageCount < 1;
}

export function applicantMessagingHintWhenBlocked(
  canSend: boolean,
): string | undefined {
  return canSend ? undefined : APPLICANT_MESSAGING_LIMIT_HINT;
}
