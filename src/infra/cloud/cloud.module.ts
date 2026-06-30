import { Global, Module } from '@nestjs/common';
import { WechatMiniModule } from '../../modules/auth/wechat-mini.module';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageUploadService } from './cloud-storage-upload.service';

@Global()
@Module({
  imports: [WechatMiniModule],
  providers: [CloudStorageService, CloudStorageUploadService],
  exports: [CloudStorageService, CloudStorageUploadService],
})
export class CloudModule {}
