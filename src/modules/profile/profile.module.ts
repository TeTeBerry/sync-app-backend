import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EventPackageEntitlement,
  EventPackageEntitlementSchema,
} from '../../database/schemas/event-package-entitlement.schema';
import {
  UserFreeQuota,
  UserFreeQuotaSchema,
} from '../../database/schemas/user-free-quota.schema';
import { ActivityModule } from '../activity/activity.module';
import { PartnerModule } from '../partner/partner.module';
import { UserModule } from '../user/user.module';
import { ProfileController } from './profile.controller';
import { ProfileEntitlementConsumeService } from './profile-entitlement-consume.service';
import { ProfileFreeQuotaService } from './profile-free-quota.service';
import { ProfilePackageService } from './profile-package.service';
import { ProfileSummaryService } from './profile-summary.service';

@Module({
  imports: [
    forwardRef(() => ActivityModule),
    forwardRef(() => PartnerModule),
    UserModule,
    MongooseModule.forFeature([
      {
        name: EventPackageEntitlement.name,
        schema: EventPackageEntitlementSchema,
      },
      {
        name: UserFreeQuota.name,
        schema: UserFreeQuotaSchema,
      },
    ]),
  ],
  controllers: [ProfileController],
  providers: [
    ProfileSummaryService,
    ProfileFreeQuotaService,
    ProfilePackageService,
    ProfileEntitlementConsumeService,
  ],
  exports: [
    ProfileSummaryService,
    ProfileFreeQuotaService,
    ProfilePackageService,
    ProfileEntitlementConsumeService,
  ],
})
export class ProfileModule {}
