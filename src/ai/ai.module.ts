import { Module } from '@nestjs/common';
import { SceneRunModule } from './scene/scene-run.module';

@Module({
  imports: [SceneRunModule],
  exports: [SceneRunModule],
})
export class AiModule {}
