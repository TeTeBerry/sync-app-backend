import { Module } from '@nestjs/common';
import { CosController } from './cos.controller';
import { CosService } from './cos.service';
import { CosStorageService } from './cos-storage.service';

@Module({
  controllers: [CosController],
  providers: [CosService, CosStorageService],
  exports: [CosService, CosStorageService],
})
export class CosModule {}
