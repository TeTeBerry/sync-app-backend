import { Controller, Get, Query } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('pindan')
  listPindan(@Query('userId') userId?: string) {
    return this.profileService.listMyPindan(userId);
  }

  @Get('tickets')
  listTickets(@Query('userId') userId?: string) {
    return this.profileService.listMyTickets(userId);
  }
}
