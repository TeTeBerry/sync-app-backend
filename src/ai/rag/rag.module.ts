import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ActivityKnowledgeService } from './activity-knowledge.service';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';

@Module({
  imports: [InfraChromaModule, ActivityModule],
  providers: [ActivityKnowledgeService],
  exports: [InfraChromaModule, ActivityKnowledgeService],
})
export class RagModule {}
