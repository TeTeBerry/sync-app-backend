/**
 * Dependency mocks for AiService integration-style unit tests.
 * Register via jest.mock('@src/...') in specs that construct AiService.
 */
module.exports = {
  LlmService: class MockLlmService {},
  IntentRouterService: class MockIntentRouterService {},
  PostIntentService: class MockPostIntentService {},
  DeterministicReplyService: class MockDeterministicReplyService {},
  UserProfileAgent: class MockUserProfileAgent {},
  AiRateLimitService: class MockAiRateLimitService {},
  ChatService: class MockChatService {},
};
