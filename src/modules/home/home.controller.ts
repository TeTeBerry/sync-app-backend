import { Controller, Get, Query } from '@nestjs/common';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  summary(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.homeService.getSummary(userId, authorName);
  }
}
