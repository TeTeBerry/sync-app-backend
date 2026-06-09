import { Injectable } from '@nestjs/common';
import { LlmService } from '../../ai/llm/llm.service';
import type { DjCatalogItem } from './dj.types';
import { hasCjkText, translateCountryToZh } from './dj-country-zh.util';

const PROFILE_TRANSLATE_SYSTEM = [
  '你是专业音乐领域译者。',
  '将用户给出的英文 DJ/艺人简介翻译成简洁自然的中文。',
  '保留艺名、厂牌、地名等专有名词的英文原文。',
  '只输出译文，不要解释，不要加标题。',
].join('\n');

@Injectable()
export class DjLocaleService {
  constructor(private readonly llmService: LlmService) {}

  localizeCountry(country?: string): string {
    return translateCountryToZh(country);
  }

  async localizeProfile(profile?: string): Promise<string> {
    const trimmed = profile?.trim() ?? '';
    if (!trimmed) {
      return '';
    }
    if (hasCjkText(trimmed)) {
      return trimmed;
    }
    if (!this.llmService.enabled) {
      return trimmed;
    }

    const translated = await this.llmService.invokeText(
      PROFILE_TRANSLATE_SYSTEM,
      trimmed,
      20_000,
    );
    return translated?.trim() || trimmed;
  }

  async localizeCatalogItem(item: DjCatalogItem): Promise<DjCatalogItem> {
    return {
      ...item,
      country: this.localizeCountry(item.country),
      profile: await this.localizeProfile(item.profile),
    };
  }
}
