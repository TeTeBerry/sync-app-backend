import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PostApplication,
  PostApplicationDocument,
} from '../../../database/schemas/post-application.schema';
import type { PostBuddyPreviewDto } from '../dto/post-buddy-preview.dto';
import { buddyPreviewFromApplicationRow } from '../light-apply.util';
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import { pickBestMatchingPostRecord } from '../utils/buddy-post-match.util';

@Injectable()
export class ApplicationBuddyPreviewService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
  ) {}

  async loadBuddyPreviewsForApplicants(
    applicantUserIds: string[],
    targetPost: PostRecord,
  ): Promise<Map<string, PostBuddyPreviewDto>> {
    const map = new Map<string, PostBuddyPreviewDto>();
    if (!applicantUserIds.length || targetPost.activityLegacyId == null) {
      return map;
    }

    const postId = String(targetPost._id);
    const uniqueIds = [...new Set(applicantUserIds.map((id) => id.trim()))];

    const lightApplications = await this.applicationModel
      .find({ postId, userId: { $in: uniqueIds } })
      .select('userId lightDepartureCity lightTripDays lightGenderPref')
      .lean();
    const lightByUser = new Map(
      lightApplications.map((row) => [row.userId, row]),
    );

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const recruiting = await this.findBestRecruitingPostForUser(
          userId,
          targetPost,
        );
        if (recruiting) {
          map.set(userId, PostMapper.toBuddyPreview(recruiting));
          return;
        }
        const fromLight = buddyPreviewFromApplicationRow(
          lightByUser.get(userId),
        );
        if (fromLight) {
          map.set(userId, fromLight);
        }
      }),
    );
    return map;
  }

  private async findBestRecruitingPostForUser(
    userId: string,
    targetPost: PostRecord,
  ): Promise<PostRecord | null> {
    const activityLegacyId = targetPost.activityLegacyId;
    if (activityLegacyId == null) return null;
    const candidates =
      await this.repository.findOwnerRecruitingPostsForActivity(
        { userId },
        activityLegacyId,
      );
    return pickBestMatchingPostRecord(targetPost, candidates);
  }
}
