import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  UserFeedback,
  UserFeedbackDocument,
} from '../../database/schemas/user-feedback.schema';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(UserFeedback.name)
    private readonly feedbackModel: Model<UserFeedbackDocument>,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  async submit(
    dto: CreateFeedbackDto,
    actor: RequestActor,
  ): Promise<{ ok: true; id: string }> {
    const content = dto.content.trim();
    await this.wechatContentSecurity.assertTextSafe(content);

    const created = await this.feedbackModel.create({
      userId: actor.resolvedUserId,
      content,
    });

    return { ok: true, id: String(created._id) };
  }
}
