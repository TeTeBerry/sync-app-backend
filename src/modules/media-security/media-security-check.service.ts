import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MediaSecurityCheck,
  MediaSecurityCheckStatus,
} from '../../database/schemas/media-security-check.schema';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../user/interfaces/user.repository.interface';

export type MediaSecurityCheckView = {
  url: string;
  status: MediaSecurityCheckStatus;
  traceId?: string;
  displayUrl?: string;
};

/**
 * Legacy WeChat async media_check callbacks (Mongo records from pre-cloud HTTPS uploads).
 * New UGC uses cloud:// fileIDs — no server-side fetch or pending checks.
 */
@Injectable()
export class MediaSecurityCheckService {
  private readonly logger = new Logger(MediaSecurityCheckService.name);

  constructor(
    @InjectModel(MediaSecurityCheck.name)
    private readonly model: Model<MediaSecurityCheck>,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  async resolveOpenid(userId: string): Promise<string> {
    const trimmed = userId.trim();
    const user = await this.users.findByExternalId(trimmed);
    const openid = user?.openid?.trim();
    if (openid) {
      return openid;
    }
    if (trimmed.startsWith('wx_')) {
      return trimmed.slice(3);
    }
    throw new BadRequestException('图片安全检测需要微信登录');
  }

  async findByImageUrl(
    imageUrl: string,
    userId: string,
  ): Promise<MediaSecurityCheck | null> {
    return this.model
      .findOne({ imageUrl: imageUrl.trim(), userId: userId.trim() })
      .lean();
  }

  async findByTraceId(traceId: string): Promise<MediaSecurityCheck | null> {
    return this.model.findOne({ traceId: traceId.trim() }).lean();
  }

  async markApproved(
    traceId: string,
    wechatResult?: Record<string, unknown>,
  ): Promise<MediaSecurityCheck | null> {
    return this.model
      .findOneAndUpdate(
        { traceId: traceId.trim() },
        { status: 'approved', wechatResult },
        { new: true },
      )
      .lean();
  }

  async markRejected(
    traceId: string,
    wechatResult?: Record<string, unknown>,
  ): Promise<MediaSecurityCheck | null> {
    return this.model
      .findOneAndUpdate(
        { traceId: traceId.trim() },
        { status: 'rejected', wechatResult },
        { new: true },
      )
      .lean();
  }

  async expireIfNeeded(
    record: MediaSecurityCheck,
  ): Promise<MediaSecurityCheck> {
    if (record.status !== 'pending') {
      return record;
    }
    if (record.expiresAt.getTime() > Date.now()) {
      return record;
    }
    const updated = await this.model
      .findOneAndUpdate(
        { traceId: record.traceId },
        { status: 'expired' },
        { new: true },
      )
      .lean();
    return updated ?? { ...record, status: 'expired' };
  }

  /** Cloud fileID uploads skip server media-check records. */
  async assertImagesApprovedForUser(
    _imageUrls: string[],
    _userId: string,
  ): Promise<void> {
    return;
  }

  async toView(
    record: MediaSecurityCheck,
    _requesterUserId: string,
  ): Promise<MediaSecurityCheckView> {
    const refreshed = await this.expireIfNeeded(record);
    return {
      url: refreshed.imageUrl,
      status: refreshed.status,
      traceId: refreshed.status === 'pending' ? refreshed.traceId : undefined,
    };
  }
}
