export type TeamChatMessageDto = {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  /** Relative to the requesting user. */
  role: 'me' | 'peer';
};
