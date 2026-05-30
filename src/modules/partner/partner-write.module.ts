import { Module, forwardRef } from '@nestjs/common';
import { ChromaModule } from '../../ai/rag/chroma.module';
import { PostAgentAdaptersModule } from '../../ai/adapters/post-agent-adapters.module';
import { ActivityModule } from '../activity/activity.module';
import { UserModule } from '../user/user.module';
import { PostWriteService } from './application/post-write.service';
import { PartnerRepositoryModule } from './partner-repository.module';

@Module({
  imports: [
    PartnerRepositoryModule,
    UserModule,
    forwardRef(() => ActivityModule),
    ChromaModule,
    PostAgentAdaptersModule,
  ],
  providers: [PostWriteService],
  exports: [PostWriteService],
})
export class PartnerWriteModule {}
