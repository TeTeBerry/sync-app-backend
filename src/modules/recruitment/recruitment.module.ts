import { Module } from '@nestjs/common';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { PartnerRepositoryModule } from '../partner/partner-repository.module';
import { PostRecruitmentService } from './application/post-recruitment.service';

@Module({
  imports: [PartnerRepositoryModule, InfraChromaModule],
  providers: [PostRecruitmentService],
  exports: [PostRecruitmentService],
})
export class RecruitmentModule {}
