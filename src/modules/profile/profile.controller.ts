import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  parseActivityLegacyIdQuery,
  resolveEffectiveActivityLegacyId,
} from '../../common/activity/activity-context.util';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ConsumeProfileEntitlementDto } from './dto/consume-profile-entitlement.dto';
import { PurchaseProfilePackageDto } from './dto/purchase-profile-package.dto';
import { ProfileEntitlementConsumeService } from './profile-entitlement-consume.service';
import { ProfilePackageService } from './profile-package.service';
import { ProfileSummaryService } from './profile-summary.service';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileSummaryService: ProfileSummaryService,
    private readonly profilePackageService: ProfilePackageService,
    private readonly profileEntitlementConsumeService: ProfileEntitlementConsumeService,
  ) {}

  @Get('packages')
  listPackages() {
    return this.profilePackageService.getPackageCatalog();
  }

  @Get('entitlements')
  listEntitlements(
    @CurrentActor() actor: RequestActor,
    @Query('activityLegacyId') activityLegacyId?: string,
    @Req() req?: Request,
  ) {
    const legacyId = resolveEffectiveActivityLegacyId(
      parseActivityLegacyIdQuery(activityLegacyId),
      req?.scopedActivityLegacyId,
    );
    return this.profilePackageService.listEntitlements(actor, legacyId);
  }

  @Post('entitlements/consume/ai-match')
  consumeAiMatch(
    @Body() body: ConsumeProfileEntitlementDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.profileEntitlementConsumeService.consumeAiMatch(
      actor,
      body.activityLegacyId,
    );
  }

  @Post('entitlements/consume/contact-unlock')
  consumeContactUnlock(
    @Body() body: ConsumeProfileEntitlementDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.profileEntitlementConsumeService.consumeContactUnlock(
      actor,
      body.activityLegacyId,
    );
  }

  @Post('packages/purchase')
  purchasePackage(
    @Body() body: PurchaseProfilePackageDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.profilePackageService.purchasePackage(
      body.tierId,
      body.activityLegacyId,
      actor,
    );
  }

  @Get()
  summary(
    @CurrentActor() actor: RequestActor,
    @Query('activityLegacyId') activityLegacyId?: string,
    @Req() req?: Request,
  ) {
    const legacyId = resolveEffectiveActivityLegacyId(
      parseActivityLegacyIdQuery(activityLegacyId),
      req?.scopedActivityLegacyId,
    );
    return this.profileSummaryService.getSummary(actor, undefined, legacyId);
  }

  @Get('activities')
  listActivities(@CurrentActor() actor: RequestActor) {
    return this.profileSummaryService.listActivities(actor);
  }

  @Get('posts')
  listPosts(@CurrentActor() actor: RequestActor) {
    return this.profileSummaryService.listPosts(actor);
  }
}
