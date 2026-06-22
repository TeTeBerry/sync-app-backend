import { BuddyPostSearchParseService } from '@src/modules/partner/application/buddy-post-search-parse.service';

describe('BuddyPostSearchParseService', () => {
  const llmService = {
    enabled: true,
    invokeJson: jest.fn(),
  };

  let service: BuddyPostSearchParseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuddyPostSearchParseService(llmService as never);
  });

  it('uses rule parse for city-only queries without calling LLM', async () => {
    const result = await service.parse('杭州出发');

    expect(result.source).toBe('rule');
    expect(result.parsed.departureCity).toBe('杭州');
    expect(llmService.invokeJson).not.toHaveBeenCalled();
  });

  it('calls LLM for complex queries when enabled', async () => {
    llmService.invokeJson.mockResolvedValue({
      departureCity: '杭州',
      searchTerms: [],
    });

    const result = await service.parse('想找能一起逛主舞台的小伙伴');

    expect(result.source).toBe('llm');
    expect(result.parsed.departureCity).toBe('杭州');
    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
    expect(llmService.invokeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('主舞台'),
      5000,
      { reasoningEffort: 'no_think' },
    );
  });

  it('falls back to rule parse when LLM returns nothing', async () => {
    llmService.invokeJson.mockResolvedValue(null);

    const result = await service.parse('想找能一起逛主舞台的小伙伴');

    expect(result.source).toBe('rule');
    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
  });

  it('tryLlmParse passes no_think and short timeout', async () => {
    llmService.invokeJson.mockResolvedValue({
      genre: 'Techno',
      searchTerms: ['Techno'],
    });

    const parsed = await service.tryLlmParse('喜欢 Techno');

    expect(parsed?.genre).toBe('Techno');
    expect(llmService.invokeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      5000,
      { reasoningEffort: 'no_think' },
    );
  });
});
