import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CosService } from './cos.service';

@Controller('cos')
export class CosController {
  constructor(private readonly cosService: CosService) {}

  @Get('sts-key')
  getStsKey(@CurrentActor() actor: RequestActor) {
    return this.cosService.getStsKey(actor.clientUserId);
  }
}
