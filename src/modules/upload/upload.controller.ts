import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CheckUploadStatusDto } from './dto/check-upload-status.dto';
import { SignedUploadUrlsDto } from './dto/signed-upload-urls.dto';
import { VerifyCosUploadDto } from './dto/verify-cos-upload.dto';
import { UploadService, UploadedImageFile } from './upload.service';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @UploadedFile() file: UploadedImageFile,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.uploadService.saveImageFile(file, actor.clientUserId);
  }

  @Post('verify')
  verifyCosUpload(
    @Body() body: VerifyCosUploadDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.uploadService.verifyCosUpload(body.url, actor.clientUserId);
  }

  @Post('check-status')
  checkUploadStatus(
    @Body() body: CheckUploadStatusDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.uploadService.getCheckStatus(body.urls, actor.clientUserId);
  }

  @Post('signed-urls')
  resolveSignedUrls(
    @Body() body: SignedUploadUrlsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.uploadService.resolveSignedDisplayUrls(
      body.urls,
      actor.clientUserId,
    );
  }
}
