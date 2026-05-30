import { Module } from '@nestjs/common';
import { ChromaModule } from '../../ai/rag/chroma.module';
import { PartnerRepositoryModule } from '../partner/partner-repository.module';
import { PostRecruitmentService } from './application/post-recruitment.service';

@Module({
  imports: [PartnerRepositoryModule, ChromaModule],
  providers: [PostRecruitmentService],
  exports: [PostRecruitmentService],
})
export class RecruitmentModule {}
