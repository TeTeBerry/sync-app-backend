import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  health() {
    return {
      ok: true,
      ai: {
        transport: 'websocket',
        path: '/api/ai/chat/ws',
      },
      ...this.healthService.getInfraHealth(),
    };
  }
}
