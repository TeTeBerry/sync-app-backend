import {
  collectTravelGuideProseSamples,
  isMostlyEnglishProse,
  passesTravelGuideLocaleLanguage,
} from '@src/modules/travel-guide/domain/travel-guide-locale-language.util';
import type { LlmTravelGuidePayload } from '@src/modules/travel-guide/domain/travel-guide-llm.types';
import { getTravelGuideMapJsonSystem } from '@src/modules/travel-guide/travel-guide-llm-prompts';

describe('travel-guide-locale-language', () => {
  it('accepts English-dominated prose', () => {
    expect(
      isMostlyEnglishProse([
        'Fly from London Heathrow to Brussels.',
        'Take a taxi from the airport to De Schorre.',
      ]),
    ).toBe(true);
  });

  it('rejects Chinese-dominated prose', () => {
    expect(
      isMostlyEnglishProse([
        '从伦敦希思罗机场飞往布鲁塞尔。',
        '抵达后打车前往会场。',
      ]),
    ).toBe(false);
  });

  it('allows a few CJK proper nouns inside English copy', () => {
    expect(
      isMostlyEnglishProse([
        'Book via Ctrip / Agoda near 安特卫普 Centraal.',
        'Estimated total (solo): About $400–600.',
      ]),
    ).toBe(true);
  });

  it('ignores hotel names when checking EN locale language', () => {
    const payload: LlmTravelGuidePayload = {
      transportLines: ['Fly from New York to Brussels and clear immigration.'],
      hotels: [
        {
          name: '安特卫普码头酒店',
          note: 'About $180/night, 2.4 km from the venue.',
          reason: 'Best balance of price and distance.',
        },
      ],
      nightlifeSpots: [],
      tipItems: ['Carry a backup payment card.'],
      ticketChannels: [
        { name: 'Official site', note: 'Buy early bird passes.' },
      ],
      venueTransportOptions: [
        { label: 'Taxi', lines: ['About 25 minutes from the airport.'] },
      ],
      budgetItems: [
        { label: 'Flights', range: 'About $600–900', note: 'Round trip' },
      ],
    };
    expect(collectTravelGuideProseSamples(payload).join(' ')).not.toContain(
      '安特卫普码头酒店',
    );
    expect(passesTravelGuideLocaleLanguage(payload, 'en')).toBe(true);
  });

  it('rejects EN payload when transport lines are Chinese', () => {
    const payload: LlmTravelGuidePayload = {
      transportLines: ['从纽约飞往布鲁塞尔，落地后通关。'],
      hotels: [],
      nightlifeSpots: [],
      tipItems: ['提前买票'],
      ticketChannels: [{ name: '官网', note: '尽早购票' }],
      venueTransportOptions: [
        { label: '打车', lines: ['机场到会场约 25 分钟'] },
      ],
      budgetItems: [{ label: '机票', range: '约 ¥4000–6000' }],
    };
    expect(passesTravelGuideLocaleLanguage(payload, 'en')).toBe(false);
    expect(passesTravelGuideLocaleLanguage(payload, 'zh')).toBe(true);
  });
});

describe('getTravelGuideMapJsonSystem', () => {
  it('returns English LANGUAGE mandate for locale=en', () => {
    const prompt = getTravelGuideMapJsonSystem('en', 2);
    expect(prompt).toContain('LANGUAGE (mandatory)');
    expect(prompt).toContain(
      'Do NOT write Simplified/Traditional Chinese prose',
    );
    expect(prompt).not.toContain('生动中文攻略');
  });

  it('returns no-stay English prompt when nights=0', () => {
    const prompt = getTravelGuideMapJsonSystem('en', 0);
    expect(prompt).toContain('LANGUAGE (mandatory)');
    expect(prompt).toContain('not staying overnight');
  });

  it('returns Chinese language mandate for locale=zh', () => {
    const prompt = getTravelGuideMapJsonSystem('zh', 2);
    expect(prompt).toContain('语言要求（强制）');
    expect(prompt).toContain('生动中文攻略');
    expect(prompt).not.toContain('LANGUAGE (mandatory)');
  });
});
