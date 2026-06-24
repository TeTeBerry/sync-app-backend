import { Module } from '@nestjs/common';
import { PartnerModule } from '../../modules/partner/partner.module';
import { UserModule } from '../../modules/user/user.module';
import { RecruitSearchSceneHandler } from './handlers/recruit-search.handler';
import { SceneRunController } from './scene-run.controller';
import { SceneRunService } from './scene-run.service';

@Module({
  imports: [PartnerModule, UserModule],
  controllers: [SceneRunController],
  providers: [RecruitSearchSceneHandler, SceneRunService],
  exports: [SceneRunService],
})
export class SceneRunModule {}
