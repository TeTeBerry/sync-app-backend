import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CosModule } from '../cos/cos.module';
import { MediaSecurityModule } from '../media-security/media-security.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [AuthModule, CosModule, MediaSecurityModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
