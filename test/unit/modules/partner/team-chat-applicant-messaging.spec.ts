import {
  APPLICANT_MESSAGING_LIMIT_HINT,
  applicantMessagingHintWhenBlocked,
  canApplicantSendBeforeOwnerReply,
} from '@src/modules/partner/team-chat-applicant-messaging';

describe('team-chat-applicant-messaging', () => {
  it('allows applicant send when owner has replied', () => {
    expect(
      canApplicantSendBeforeOwnerReply({
        ownerHasReplied: true,
        applicantMessageCount: 3,
      }),
    ).toBe(true);
  });

  it('blocks applicant when owner has not replied and apply message exists', () => {
    expect(
      canApplicantSendBeforeOwnerReply({
        ownerHasReplied: false,
        applicantMessageCount: 1,
      }),
    ).toBe(false);
  });

  it('allows first applicant message before owner reply', () => {
    expect(
      canApplicantSendBeforeOwnerReply({
        ownerHasReplied: false,
        applicantMessageCount: 0,
      }),
    ).toBe(true);
  });

  it('returns hint only when blocked', () => {
    expect(applicantMessagingHintWhenBlocked(true)).toBeUndefined();
    expect(applicantMessagingHintWhenBlocked(false)).toBe(
      APPLICANT_MESSAGING_LIMIT_HINT,
    );
  });
});
