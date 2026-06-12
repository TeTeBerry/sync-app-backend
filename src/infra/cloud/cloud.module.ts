import { Global, Module } from '@nestjs/common';
import { WechatMiniModule } from '../../modules/auth/wechat-mini.module';
import { CloudStorageService } from './cloud-storage.service';

@Global()
@Module({
  imports: [WechatMiniModule],
  providers: [CloudStorageService],
  exports: [CloudStorageService],
})
export class CloudModule {}
