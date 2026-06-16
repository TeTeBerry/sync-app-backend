import { Body, Controller, Get, Post } from '@nestjs/common';
import { SubmitPersonalityTestDto } from './dto/submit-personality-test.dto';
import { PersonalityTestService } from './personality-test.service';

@Controller('personality-test')
export class PersonalityTestController {
  constructor(private readonly personalityTest: PersonalityTestService) {}

  @Get('catalog')
  getCatalog() {
    return this.personalityTest.getCatalog();
  }

  @Get('questions')
  getQuestions() {
    return this.personalityTest.getQuestions();
  }

  @Post('submit')
  submit(@Body() body: SubmitPersonalityTestDto) {
    return this.personalityTest.submit(body);
  }
}
