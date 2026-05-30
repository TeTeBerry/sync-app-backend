import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
    @Query('activityLegacyId') activityLegacyId?: string,
  ) {
    const legacyId =
      activityLegacyId != null && activityLegacyId !== ''
        ? Number(activityLegacyId)
        : undefined;
    return this.profilePackageService.listEntitlements(
      userId,
      authorName,
      legacyId,
    );
  }

  @Post('entitlements/consume/ai-match')
  consumeAiMatch(
    @Body() body: ConsumeProfileEntitlementDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileEntitlementConsumeService.consumeAiMatch(
      userId,
      authorName,
      body.activityLegacyId,
    );
  }

  @Post('entitlements/consume/contact-unlock')
  consumeContactUnlock(
    @Body() body: ConsumeProfileEntitlementDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileEntitlementConsumeService.consumeContactUnlock(
      userId,
      authorName,
      body.activityLegacyId,
    );
  }

  @Post('packages/purchase')
  purchasePackage(
    @Body() body: PurchaseProfilePackageDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profilePackageService.purchasePackage(
      body.tierId,
      body.activityLegacyId,
      userId,
      authorName,
    );
  }

  @Get()
  summary(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
    @Query('activityLegacyId') activityLegacyId?: string,
  ) {
    const legacyId =
      activityLegacyId != null && activityLegacyId !== ''
        ? Number(activityLegacyId)
        : undefined;
    return this.profileSummaryService.getSummary(
      userId,
      authorName,
      undefined,
      undefined,
      legacyId,
    );
  }

  @Get('activities')
  listActivities(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileSummaryService.listActivities(userId, authorName);
  }

  @Get('posts')
  listPosts(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileSummaryService.listPosts(userId, authorName);
  }
}
