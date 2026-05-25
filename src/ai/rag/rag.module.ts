import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ActivityKnowledgeService } from './activity-knowledge.service';
import { ChromaModule } from './chroma.module';

@Module({
  imports: [ChromaModule, ActivityModule],
  providers: [ActivityKnowledgeService],
  exports: [ChromaModule, ActivityKnowledgeService],
})
export class RagModule {}
