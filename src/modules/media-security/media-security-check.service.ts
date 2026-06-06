import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  assertCosPostImageUrlForUser,
  normalizeCosPostImageUrl,
  parseCosObjectKeyFromUrl,
} from '../../common/cos/cos-upload-url.util';
import {
  MediaSecurityCheck,
  MediaSecurityCheckStatus,
} from '../../database/schemas/media-security-check.schema';
import { CosStorageService } from '../cos/cos-storage.service';
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

@Injectable()
export class MediaSecurityCheckService {
  private readonly logger = new Logger(MediaSecurityCheckService.name);

  constructor(
    @InjectModel(MediaSecurityCheck.name)
    private readonly model: Model<MediaSecurityCheck>,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    private readonly cosStorage: CosStorageService,
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
    const normalized = normalizeCosPostImageUrl(imageUrl.trim());
    return this.model
      .findOne({ imageUrl: normalized, userId: userId.trim() })
      .lean();
  }

  async findByTraceId(traceId: string): Promise<MediaSecurityCheck | null> {
    return this.model.findOne({ traceId: traceId.trim() }).lean();
  }

  async createPending(params: {
    traceId: string;
    userId: string;
    openid: string;
    imageUrl: string;
    scene: number;
    expiresAt: Date;
  }): Promise<MediaSecurityCheck> {
    const imageUrl = normalizeCosPostImageUrl(params.imageUrl.trim());
    const cosKey = parseCosObjectKeyFromUrl(imageUrl);
    return this.model.create({
      traceId: params.traceId,
      userId: params.userId.trim(),
      openid: params.openid.trim(),
      imageUrl,
      cosKey,
      scene: params.scene,
      status: 'pending',
      expiresAt: params.expiresAt,
    });
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
    const record = await this.model
      .findOneAndUpdate(
        { traceId: traceId.trim() },
        { status: 'rejected', wechatResult },
        { new: true },
      )
      .lean();
    if (record) {
      await this.cosStorage.deleteObjectByKey(record.cosKey);
    }
    return record;
  }

  async markSubmitFailed(
    imageUrl: string,
    userId: string,
    openid: string,
    scene: number,
    expiresAt: Date,
    wechatResult?: Record<string, unknown>,
  ): Promise<void> {
    const normalized = normalizeCosPostImageUrl(imageUrl.trim());
    const cosKey = parseCosObjectKeyFromUrl(normalized);
    const traceId = `failed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await this.model.create({
      traceId,
      userId: userId.trim(),
      openid: openid.trim(),
      imageUrl: normalized,
      cosKey,
      scene,
      status: 'submit_failed',
      wechatResult,
      expiresAt,
    });
    await this.cosStorage.deleteObjectByKey(cosKey);
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
    if (updated) {
      await this.cosStorage.deleteObjectByKey(updated.cosKey);
      return updated;
    }
    return { ...record, status: 'expired' };
  }

  async assertImagesApprovedForUser(
    imageUrls: string[],
    userId: string,
  ): Promise<void> {
    if (!imageUrls.length) {
      return;
    }
    for (const raw of imageUrls) {
      const url = normalizeCosPostImageUrl(raw.trim());
      assertCosPostImageUrlForUser(url, userId);
      let record = await this.findByImageUrl(url, userId);
      if (!record) {
        throw new BadRequestException('图片尚未通过安全检测，请重新上传');
      }
      record = await this.expireIfNeeded(record);
      if (record.status !== 'approved') {
        throw new BadRequestException(
          record.status === 'pending'
            ? '图片安全检测中，请稍后再发布'
            : '图片未通过安全检测，请更换后重试',
        );
      }
    }
  }

  canRequestSignedUrl(
    record: MediaSecurityCheck,
    requesterUserId: string,
  ): boolean {
    if (record.status === 'approved') {
      return true;
    }
    return (
      record.userId === requesterUserId.trim() && record.status === 'pending'
    );
  }

  async recordApproved(params: {
    userId: string;
    openid: string;
    imageUrl: string;
    scene: number;
  }): Promise<MediaSecurityCheck> {
    const imageUrl = normalizeCosPostImageUrl(params.imageUrl.trim());
    const existing = await this.findByImageUrl(imageUrl, params.userId);
    if (existing?.status === 'approved') {
      return existing;
    }
    const cosKey = parseCosObjectKeyFromUrl(imageUrl);
    const traceId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return this.model.create({
      traceId,
      userId: params.userId.trim(),
      openid: params.openid.trim(),
      imageUrl,
      cosKey,
      scene: params.scene,
      status: 'approved',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
  }

  async toView(
    record: MediaSecurityCheck,
    requesterUserId: string,
  ): Promise<MediaSecurityCheckView> {
    const refreshed = await this.expireIfNeeded(record);
    const view: MediaSecurityCheckView = {
      url: refreshed.imageUrl,
      status: refreshed.status,
      traceId: refreshed.status === 'pending' ? refreshed.traceId : undefined,
    };
    if (this.canRequestSignedUrl(refreshed, requesterUserId)) {
      view.displayUrl = await this.cosStorage.getSignedObjectUrl(
        refreshed.cosKey,
      );
    }
    return view;
  }

  async resolveSignedDisplayUrls(
    urls: string[],
    _requesterUserId: string,
  ): Promise<Array<{ inputUrl: string; url: string; displayUrl?: string }>> {
    const results: Array<{
      inputUrl: string;
      url: string;
      displayUrl?: string;
    }> = [];
    for (const raw of urls) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const key = parseCosObjectKeyFromUrl(trimmed);
        if (!key.startsWith('uploads/posts/')) {
          results.push({ inputUrl: trimmed, url: trimmed });
          continue;
        }
        const normalized = normalizeCosPostImageUrl(trimmed);
        const displayUrl = await this.cosStorage.getSignedObjectUrl(key);
        results.push({ inputUrl: trimmed, url: normalized, displayUrl });
      } catch {
        results.push({ inputUrl: trimmed, url: trimmed });
      }
    }
    return results;
  }
}
