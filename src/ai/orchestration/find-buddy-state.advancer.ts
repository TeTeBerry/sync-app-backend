import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  applyFindBuddyInput,
  mergeFindBuddyFacts,
  startFindBuddyFlow,
  type ConversationState,
} from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { FindBuddyImageParserService } from '../parser/find-buddy-image-parser.service';
import { mergeFindBuddyState, isLockedPackageFlow } from '../parser/find-buddy-merge.util';
import { applyFindBuddyActivityCorrection } from '../utils/find-buddy-correction.util';
import { LlmSlotParserService } from '../parser/llm-slot-parser.service';

/**
 * 专门负责找搭子流程的状态推进
 */
@Injectable()
export class FindBuddyStateAdvancer {
  constructor(
    private readonly activityService: ActivityService,
    private readonly findBuddyImageParser: FindBuddyImageParserService,
    private readonly llmSlotParser: LlmSlotParserService,
  ) {}

  async advance(
    state: ConversationState,
    messages: ChatMessageDto[],
    input: string,
    image?: string,
  ): Promise<ConversationState> {
    const rawBase =
      state.findBuddy ??
      ({
        phase: 'pick_activity',
        joinablePindanIds: [],
      } as import('../conversation/conversation-state.types').FindBuddyState);

    const base = applyFindBuddyActivityCorrection(rawBase, input);

    const visionRaw = image?.trim()
      ? await this.findBuddyImageParser.parseFindBuddyImage(image, input)
      : null;

    let ruleState = await applyFindBuddyInput(
      { ...state, findBuddy: { ...base } },
      messages,
      input,
      this.activityService,
    );
    ruleState = mergeFindBuddyFacts(ruleState, messages, input);

    const lockedPackageFlow = isLockedPackageFlow(ruleState.findBuddy ?? base);
    const llmRaw = lockedPackageFlow
      ? null
      : await this.llmSlotParser.parseFindBuddySlots(
          input,
          ruleState.findBuddy ?? base,
        );

    let mergedFindBuddy = mergeFindBuddyState({
      base,
      visionRaw,
      ruleState: ruleState.findBuddy ?? base,
      llmRaw,
      input,
    });

    mergedFindBuddy = applyFindBuddyActivityCorrection(mergedFindBuddy, input);

    return {
      ...state,
      flow: 'find_buddy',
      findBuddy: mergedFindBuddy,
    };
  }

  async advanceFromImage(
    messages: ChatMessageDto[],
    input: string,
    image?: string,
  ): Promise<ConversationState> {
    const next = startFindBuddyFlow('pick_activity');
    return this.advance(next, messages, input, image);
  }
}
