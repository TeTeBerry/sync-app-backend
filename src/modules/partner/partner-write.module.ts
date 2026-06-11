import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { PostAgentAdaptersModule } from '../../ai/adapters/post-agent-adapters.module';
import { ActivityModule } from '../activity/activity.module';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { UserModule } from '../user/user.module';
import { PostWriteService } from './application/post-write.service';
import { PartnerRepositoryModule } from './partner-repository.module';
import { LiveInfoModule } from '../live-info/live-info.module';
import { MediaSecurityModule } from '../media-security/media-security.module';

@Module({
  imports: [
    AuthModule,
    MediaSecurityModule,
    PartnerRepositoryModule,
    UserModule,
    AccountRiskModule,
    LiveInfoModule,
    forwardRef(() => ActivityModule),
    InfraChromaModule,
    PostAgentAdaptersModule,
  ],
  providers: [PostWriteService],
  exports: [PostWriteService],
})
export class PartnerWriteModule {}
