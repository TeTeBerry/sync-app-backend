import { Module } from '@nestjs/common';
import { PartnerRepositoryModule } from '../partner/partner-repository.module';
import { PostRecruitmentService } from './application/post-recruitment.service';

@Module({
  imports: [PartnerRepositoryModule],
  providers: [PostRecruitmentService],
  exports: [PostRecruitmentService],
})
export class RecruitmentModule {}
