import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health check，无需登录 */
  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
