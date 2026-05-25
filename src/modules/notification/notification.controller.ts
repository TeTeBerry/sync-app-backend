import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@Query('userId') userId?: string) {
    return this.notificationService.listByUser(userId);
  }

  @Get('unread-count')
  unreadCount(@Query('userId') userId?: string) {
    return this.notificationService.unreadCount(userId);
  }

  @Patch('read-all')
  markAllRead(@Query('userId') userId?: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.notificationService.markRead(id, userId);
  }
}
