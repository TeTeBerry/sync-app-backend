import { Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@CurrentActor() actor: RequestActor) {
    return this.notificationService.listByUser(actor);
  }

  @Get('unread-count')
  unreadCount(@CurrentActor() actor: RequestActor) {
    return this.notificationService.unreadCount(actor);
  }

  @Patch('read-all')
  markAllRead(@CurrentActor() actor: RequestActor) {
    return this.notificationService.markAllRead(actor);
  }

  @Delete()
  clearAll(@CurrentActor() actor: RequestActor) {
    return this.notificationService.clearAll(actor);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.notificationService.markRead(id, actor);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.notificationService.deleteOne(id, actor);
  }
}
