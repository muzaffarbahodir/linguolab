import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { IsString, IsInt, Min, Max } from 'class-validator';
import { PlacementTestsService } from './placement-tests.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

class StartDto {
  @IsString()
  languageId!: string;
}

class AnswerDto {
  @IsInt()
  @Min(0)
  @Max(500)
  questionId!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  answerIndex!: number;
}

@Controller('placement-tests')
export class PlacementTestsController {
  constructor(private readonly service: PlacementTestsService) {}

  /** POST /placement-tests/start */
  @Post('start')
  start(@CurrentUser() user: RequestUser, @Body() dto: StartDto) {
    return this.service.start(user.id, dto.languageId);
  }

  /** POST /placement-tests/:id/answer */
  @Post(':id/answer')
  answer(@CurrentUser() user: RequestUser, @Param('id') testId: string, @Body() dto: AnswerDto) {
    return this.service.answer(testId, user.id, dto.questionId, dto.answerIndex);
  }

  /** POST /placement-tests/:id/complete */
  @Post(':id/complete')
  complete(@CurrentUser() user: RequestUser, @Param('id') testId: string) {
    return this.service.complete(testId, user.id);
  }

  /** GET /placement-tests/my */
  @Get('my')
  myTests(@CurrentUser() user: RequestUser) {
    return this.service.myTests(user.id);
  }
}
